-- =============================================================================
-- Topic admin: header colour, who and when, an open icon set (ADR-024)
-- =============================================================================
--
-- 1. entries.hero_background: colour of a topic's header when it has no photo.
-- 2. Who and when: entries.updated_by (set on every edit); subtopics
--    (entry_chapters) get created_at/created_by/updated_at/updated_by,
--    carried over by replace_entry_parts and refreshed only for a subtopic
--    whose content changed. staff_name() shows editors' names in the admin.
-- 3. Tile icons are any icon name the app knows (the list lives in code, more
--    than a hundred); the database only checks the shape of the name.
-- =============================================================================

alter table public.entries
  add column hero_background text constraint entries_hero_background_hex check (public.is_hex_color(hero_background)),
  add column updated_by uuid references public.profiles (id) on delete set null;
create index entries_updated_by on public.entries (updated_by);
grant select (hero_background) on public.entries to anon;

create or replace function public.stamp_entry_editor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_entry_editor() from public, anon, authenticated;

create trigger entries_stamp_editor before insert or update on public.entries
  for each row execute function public.stamp_entry_editor();

alter table public.entry_chapters
  add column created_at timestamptz not null default now(),
  add column created_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references public.profiles (id) on delete set null;
create index entry_chapters_created_by on public.entry_chapters (created_by);
create index entry_chapters_updated_by on public.entry_chapters (updated_by);

-- Names of staff for "created by / edited by" lines; only for the team (staff).
create or replace function public.staff_name(p_profile uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case when exists (select 1 from profiles me where me.id = auth.uid() and me.kind = 'staff') then
           (select coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1)) from profiles p where p.id = p_profile)
         end
$$;
revoke execute on function public.staff_name(uuid) from public, anon;
grant execute on function public.staff_name(uuid) to authenticated;

create or replace function public.is_tile_icon(p_icon text)
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select p_icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(p_icon) <= 40
$$;

create or replace function public.replace_entry_parts(p_entry uuid, p_part text, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a list.' using errcode = '22023';
  end if;
  if not public.can_write_entry(p_entry) then
    raise exception 'You may not edit this entry.' using errcode = '42501';
  end if;

  case p_part
  when 'chapters' then
    if jsonb_array_length(p_items) > 12 then
      raise exception 'A dossier holds at most 12 topics.' using errcode = '22023';
    end if;
    -- Who and when: a subtopic keeps its id, creation stamp and, if nothing in
    -- it changed, its update stamp; a changed or new one is stamped now.
    v_old := (select coalesce(jsonb_object_agg(c.id::text, to_jsonb(c)), '{}'::jsonb)
                from entry_chapters c where c.entry_id = p_entry);
    delete from entry_chapters where entry_id = p_entry;
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
    delete from resources where entry_id = p_entry;
    insert into resources (entry_id, position, kind, tile_id, title, source, description, url, image_url)
    select p_entry, (ord - 1)::int, nullif(i ->> 'kind', ''), nullif(i ->> 'tile_id', '')::uuid,
           i ->> 'title', coalesce(i ->> 'source', ''),
           coalesce(i ->> 'description', ''), i ->> 'url', nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'faq' then
    if jsonb_array_length(p_items) > 20 then
      raise exception 'A dossier holds at most 20 questions.' using errcode = '22023';
    end if;
    delete from entry_faq where entry_id = p_entry;
    insert into entry_faq (entry_id, position, question, answer)
    select p_entry, (ord - 1)::int, i ->> 'question', i ->> 'answer'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'tile_notes' then
    if jsonb_array_length(p_items) > 30 then
      raise exception 'Too many tile notes.' using errcode = '22023';
    end if;
    delete from entry_tile_notes where entry_id = p_entry;
    insert into entry_tile_notes (entry_id, tile_id, body_html)
    select p_entry, (i ->> 'tile_id')::uuid, i ->> 'body_html'
    from jsonb_array_elements(p_items) as t(i)
    where length(btrim(coalesce(i ->> 'body_html', ''))) > 0;

  else
    raise exception 'Unknown entry part.' using errcode = '22023';
  end case;
end;
$$;
