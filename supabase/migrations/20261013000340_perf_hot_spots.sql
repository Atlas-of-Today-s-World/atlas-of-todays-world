-- =============================================================================
-- Database hot spots (performance audit 2026-10, P10)
-- =============================================================================
--
-- a) Entry revisions carry a stored `published` flag (generated from the
--    snapshot's status, so every insert path sets it and the existing rows are
--    filled in by the ALTER itself) with an index (entry_id, published,
--    saved_at desc). The daily prune_entry_revisions() and the approval
--    detail's "published version" (src/features/entries/revisions.ts) read the
--    flag instead of parsing every snapshot, and the prune ranks only the
--    entries that are over the limit.
--
-- b) replace_entry_parts() and replace_portrait_items() become SECURITY
--    DEFINER. As SECURITY INVOKER every deleted and inserted row went through
--    the tables' row policies (can_write_entry() per row: up to ~2000
--    subqueries for one save of 200 resources). The functions already check
--    the caller's right up front; as definer they evaluate each remaining
--    policy condition once per call instead of once per row, with the same
--    outcome for every caller:
--      * entry parts: can_write_entry(p_entry) (#183: a pending entry stays
--        frozen for whoever may not approve it); rows the caller couldn't
--        read under RLS aren't deleted (and a subtopic's old stamps aren't
--        carried over); a tile note needs a tile of this entry the caller
--        can read (the WITH CHECK of entry_tile_notes);
--      * portrait sections: the insert right as before; the old items are
--        removed only with the delete right of the section's policy
--        (news "d", resp. regions "d" / specials "e" for metric cards) —
--        without it the delete removed nothing under RLS, and it still
--        removes nothing.
--
-- c) Audit log search (src/features/roles/editorial.ts) filters
--    `ilike '%q%'` on action, target and actor_email, and on profiles.email
--    for the actor: GIN trigram indexes (pg_trgm) serve those filters
--    instead of a sequential scan. pg_trgm is available on Supabase; where it
--    isn't (plain PGlite in the DB tests), the indexes are skipped.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- a) Revisions: stored "saved while published" flag
-- ---------------------------------------------------------------------------

alter table public.entry_revisions
  add column published boolean not null
  generated always as (coalesce(snapshot ->> 'status' = 'published', false)) stored;

create index entry_revisions_entry_published
  on public.entry_revisions (entry_id, published, saved_at desc);

-- Body as in 20261008000090; ranks only the entries over the limit and reads
-- the stored flag.
create or replace function public.prune_entry_revisions()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  delete from entry_revisions r
  using (
    select id,
           row_number() over (partition by entry_id
                              order by saved_at desc, id desc) as newest,
           published,
           row_number() over (partition by entry_id, published
                              order by saved_at desc, id desc) as newest_of_kind
    from entry_revisions
    where entry_id in (select entry_id from entry_revisions
                        group by entry_id having count(*) > 50)
  ) ranked
  where r.id = ranked.id
    and ranked.newest > 50
    and not (ranked.published and ranked.newest_of_kind = 1);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke execute on function public.prune_entry_revisions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- b) Bulk part saves: policy conditions once per call
-- ---------------------------------------------------------------------------

-- Body as in 20261006000040, with the row policies' conditions checked once.
create or replace function public.replace_entry_parts(p_entry uuid, p_part text, p_items jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  -- The parts' read policies (chapters, resources, FAQ, tile notes): under RLS
  -- the delete reached only rows the caller could read.
  v_readable boolean;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a list.' using errcode = '22023';
  end if;
  -- The insert, update and delete policies of every part table.
  if not public.can_write_entry(p_entry) then
    raise exception 'You may not edit this entry.' using errcode = '42501';
  end if;
  v_readable := public.can_read_any_unpublished() or public.entry_published_or_own(p_entry);

  case p_part
  when 'chapters' then
    if jsonb_array_length(p_items) > 12 then
      raise exception 'A dossier holds at most 12 topics.' using errcode = '22023';
    end if;
    -- Who and when: a subtopic keeps its id, creation stamp and, if nothing in
    -- it changed, its update stamp; a changed or new one is stamped now.
    v_old := (select coalesce(jsonb_object_agg(c.id::text, to_jsonb(c)), '{}'::jsonb)
                from entry_chapters c where c.entry_id = p_entry and v_readable);
    delete from entry_chapters where entry_id = p_entry and v_readable;
    insert into entry_chapters (id, entry_id, position, title, summary_points, body_html,
                                illustration_url, illustration_credit, audio_url, tile_background,
                                created_at, created_by, updated_at, updated_by)
    select coalesce(o.id, gen_random_uuid()), p_entry, n.position, n.title, n.summary_points, n.body_html,
           n.illustration_url, n.illustration_credit, n.audio_url, n.tile_background,
           coalesce(o.created_at, now()), case when o.id is null then auth.uid() else o.created_by end,
           case when o.id is not null
                 and (n.title, n.summary_points, n.body_html, n.illustration_url, n.illustration_credit, n.audio_url, n.tile_background)
                     is not distinct from
                     (o.title, o.summary_points, o.body_html, o.illustration_url, o.illustration_credit, o.audio_url, o.tile_background)
                then o.updated_at else now() end,
           case when o.id is not null
                 and (n.title, n.summary_points, n.body_html, n.illustration_url, n.illustration_credit, n.audio_url, n.tile_background)
                     is not distinct from
                     (o.title, o.summary_points, o.body_html, o.illustration_url, o.illustration_credit, o.audio_url, o.tile_background)
                then o.updated_by else auth.uid() end
    from (
      select (ord - 1)::int as position, i ->> 'id' as old_id, i ->> 'title' as title,
             coalesce(array(select jsonb_array_elements_text(coalesce(i -> 'summary_points', '[]'))), '{}') as summary_points,
             coalesce(i ->> 'body_html', '') as body_html,
             nullif(i ->> 'illustration_url', '') as illustration_url,
             nullif(i ->> 'illustration_credit', '') as illustration_credit,
             nullif(i ->> 'audio_url', '') as audio_url,
             nullif(i ->> 'tile_background', '') as tile_background
        from jsonb_array_elements(p_items) with ordinality as t(i, ord)
    ) n
    left join lateral jsonb_populate_record(null::entry_chapters, v_old -> n.old_id) o
           on v_old ? coalesce(n.old_id, '');

  when 'resources' then
    if jsonb_array_length(p_items) > 200 then
      raise exception 'A dossier holds at most 200 resources.' using errcode = '22023';
    end if;
    delete from resources where entry_id = p_entry and v_readable;
    insert into resources (entry_id, position, kind, tile_id, title, source, description, url, image_url)
    select p_entry, (ord - 1)::int, nullif(i ->> 'kind', ''), nullif(i ->> 'tile_id', '')::uuid,
           i ->> 'title', coalesce(i ->> 'source', ''),
           coalesce(i ->> 'description', ''), i ->> 'url', nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'faq' then
    if jsonb_array_length(p_items) > 20 then
      raise exception 'A dossier holds at most 20 questions.' using errcode = '22023';
    end if;
    delete from entry_faq where entry_id = p_entry and v_readable;
    insert into entry_faq (entry_id, position, question, answer)
    select p_entry, (ord - 1)::int, i ->> 'question', i ->> 'answer'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'tile_notes' then
    if jsonb_array_length(p_items) > 30 then
      raise exception 'Too many tile notes.' using errcode = '22023';
    end if;
    -- WITH CHECK of entry_tile_notes: a tile of this entry (shared tiles have
    -- no entry and nobody reads them) that the caller can read.
    if exists (
      select 1
        from jsonb_array_elements(p_items) as t(i)
       where length(btrim(coalesce(i ->> 'body_html', ''))) > 0
         and not (v_readable and exists (select 1 from learn_more_tiles lt
                                          where lt.id = (i ->> 'tile_id')::uuid
                                            and lt.entry_id = p_entry))) then
      raise exception 'new row violates row-level security policy for table "entry_tile_notes"'
        using errcode = '42501';
    end if;
    delete from entry_tile_notes where entry_id = p_entry and v_readable;
    insert into entry_tile_notes (entry_id, tile_id, body_html)
    select p_entry, (i ->> 'tile_id')::uuid, i ->> 'body_html'
    from jsonb_array_elements(p_items) as t(i)
    where length(btrim(coalesce(i ->> 'body_html', ''))) > 0;

  else
    raise exception 'Unknown entry part.' using errcode = '22023';
  end case;
end;
$$;

revoke execute on function public.replace_entry_parts(uuid, text, jsonb) from public, anon;
grant execute on function public.replace_entry_parts(uuid, text, jsonb) to authenticated;

-- Body as in 20261008000030, with the row policies' conditions checked once.
create or replace function public.replace_portrait_items(
  p_kind text, p_slug text, p_collection text, p_items jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_region  text := case when p_kind = 'region' then p_slug end;
  v_special text := case when p_kind = 'issue' then p_slug end;
  v_country text := case when p_kind = 'country' then p_slug end;
  -- The delete policy of the section's table (the insert policy is checked below).
  v_may_delete boolean;
begin
  if p_kind not in ('region', 'issue', 'country') or (p_kind = 'country' and p_collection <> 'metrics') then
    raise exception 'Unknown portrait.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'A portrait section holds at most 50 items.' using errcode = '22023';
  end if;
  -- The same rights as the insert policies of the section tables.
  if not (case when p_collection = 'metrics' then public.can_edit_portrait_metric(v_special)
               else public.has_perm('news', 'e') and public.can_edit_entry(null) end) then
    raise exception 'You may not edit this portrait.' using errcode = '42501';
  end if;
  v_may_delete := case
    when p_collection = 'metrics' then
      case when v_special is not null then public.has_perm('specials', 'e')
           else public.has_perm('regions', 'd') end
    else public.has_perm('news', 'd') and public.can_edit_entry(null)
  end;

  case p_collection
  when 'timeline' then
    delete from timeline_events
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and v_may_delete;
    insert into timeline_events (region_slug, special_slug, position, date_label, title, body, image_url)
    select v_region, v_special, (ord - 1)::int, i ->> 'date_label', i ->> 'title',
           coalesce(i ->> 'body', ''), nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'faq' then
    delete from faq_items
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and v_may_delete;
    insert into faq_items (region_slug, special_slug, position, question, answer)
    select v_region, v_special, (ord - 1)::int, i ->> 'question', i ->> 'answer'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'resources' then
    delete from resources
     where entry_id is null
       and region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and v_may_delete;
    insert into resources (region_slug, special_slug, position, kind, title, source, description, url, image_url)
    select v_region, v_special, (ord - 1)::int, i ->> 'kind', i ->> 'title', coalesce(i ->> 'source', ''),
           coalesce(i ->> 'description', ''), i ->> 'url', nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'visuals' then
    delete from visual_embeds
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and v_may_delete;
    insert into visual_embeds (region_slug, special_slug, position, provider, title, caption, url)
    select v_region, v_special, (ord - 1)::int, i ->> 'provider', i ->> 'title',
           coalesce(i ->> 'caption', ''), i ->> 'url'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'metrics' then
    delete from portrait_metrics
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and country_iso3 is not distinct from v_country
       and v_may_delete;
    insert into portrait_metrics (region_slug, special_slug, country_iso3, position, value, label,
                                  description, source, source_url, period)
    select v_region, v_special, v_country, (ord - 1)::int, i ->> 'value', i ->> 'label',
           coalesce(i ->> 'description', ''), i ->> 'source', nullif(i ->> 'source_url', ''),
           nullif(i ->> 'period', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  else
    raise exception 'Unknown portrait section.' using errcode = '22023';
  end case;
end;
$$;

revoke execute on function public.replace_portrait_items(text, text, text, jsonb) from public, anon;
grant execute on function public.replace_portrait_items(text, text, text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- c) Audit log search: trigram indexes
-- ---------------------------------------------------------------------------

do $$
declare
  ops text;
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    raise notice 'pg_trgm is not available: audit search indexes skipped';
    return;
  end if;
  -- Supabase keeps extensions in their own schema (not exposed by the API).
  if to_regnamespace('extensions') is not null then
    create extension if not exists pg_trgm with schema extensions;
  else
    create extension if not exists pg_trgm;
  end if;
  -- Wherever the extension lives (it may have been enabled before).
  select format('%I.gin_trgm_ops', n.nspname) into ops
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  execute format('create index if not exists audit_log_action_trgm on public.audit_log using gin (action %s)', ops);
  execute format('create index if not exists audit_log_target_trgm on public.audit_log using gin (target %s)', ops);
  execute format('create index if not exists audit_log_actor_email_trgm on public.audit_log using gin (actor_email %s)', ops);
  execute format('create index if not exists profiles_email_trgm on public.profiles using gin (email %s)', ops);
end;
$$;
