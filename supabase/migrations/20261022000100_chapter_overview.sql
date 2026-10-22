-- A subtopic's Overview: the plain-text paragraphs (blank line between them)
-- in the box at the top of the opened subtopic, above "Full Reading". The key
-- points (summary_points, 5 × 300 characters) were too short for the old
-- site's overviews. Backward compatible: a new column with a default, and the
-- functions take and return it on top of what they did.

alter table public.entry_chapters
  add column overview text not null default ''
    constraint entry_chapters_overview_length check (char_length(overview) <= 3000);

-- Public pages read it like the rest of the subtopic (column grants, 20261008000110).
grant select (overview) on public.entry_chapters to anon;

-- Saving subtopics also stores the overview (body as in 20261013000340).
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
    insert into entry_chapters (id, entry_id, position, title, overview, summary_points, body_html,
                                illustration_url, illustration_credit, audio_url, tile_background,
                                created_at, created_by, updated_at, updated_by)
    select coalesce(o.id, gen_random_uuid()), p_entry, n.position, n.title, coalesce(n.overview, o.overview, ''), n.summary_points, n.body_html,
           n.illustration_url, n.illustration_credit, n.audio_url, n.tile_background,
           coalesce(o.created_at, now()), case when o.id is null then auth.uid() else o.created_by end,
           case when o.id is not null
                 and (n.title, coalesce(n.overview, o.overview, ''), n.summary_points, n.body_html, n.illustration_url, n.illustration_credit, n.audio_url, n.tile_background)
                     is not distinct from
                     (o.title, o.overview, o.summary_points, o.body_html, o.illustration_url, o.illustration_credit, o.audio_url, o.tile_background)
                then o.updated_at else now() end,
           case when o.id is not null
                 and (n.title, coalesce(n.overview, o.overview, ''), n.summary_points, n.body_html, n.illustration_url, n.illustration_credit, n.audio_url, n.tile_background)
                     is not distinct from
                     (o.title, o.overview, o.summary_points, o.body_html, o.illustration_url, o.illustration_credit, o.audio_url, o.tile_background)
                then o.updated_by else auth.uid() end
    from (
      select (ord - 1)::int as position, i ->> 'id' as old_id, i ->> 'title' as title,
             -- Absent (a client that predates the field): the stored overview stays.
             i ->> 'overview' as overview,
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

-- The preview link shows it too (body as in 20261005000010).
create or replace function public.entry_preview_parts(p_token text)
returns table (
  kind text, summary_points text[], author jsonb, chapters jsonb, resources jsonb,
  tiles jsonb, notes jsonb, articles_label text, learn_more_label text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.kind, e.summary_points,
         (select jsonb_build_object('name', a.name, 'photo_url', a.photo_url, 'bio', a.bio,
                                    'positionality', a.positionality)
            from authors a where a.id = e.author_id),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', c.position, 'title', c.title, 'overview', c.overview,
                     'summary_points', c.summary_points,
                     'body_html', c.body_html, 'illustration_url', c.illustration_url,
                     'illustration_credit', c.illustration_credit, 'audio_url', c.audio_url,
                     'tile_background', c.tile_background)
                     order by c.position)
                     from entry_chapters c where c.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', r.position, 'kind', r.kind, 'tile_id', r.tile_id, 'title', r.title,
                     'source', r.source, 'description', r.description, 'url', r.url,
                     'image_url', r.image_url)
                     order by r.position)
                     from resources r where r.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', t.id, 'slug', t.slug, 'label', t.label, 'description', t.description,
                     'icon', t.icon, 'image_url', t.image_url, 'image_credit', t.image_credit,
                     'background', t.background, 'position', t.position)
                     order by t.position)
                     from learn_more_tiles t where t.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('tile_id', n.tile_id, 'body_html', n.body_html))
                     from entry_tile_notes n where n.entry_id = e.id), '[]'),
         e.articles_label, e.learn_more_label
  from preview_links l
  join entries e on e.id = l.entry_id
  where p_token ~ '^[0-9a-f]{64}$'
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.expires_at > now();
$$;

revoke execute on function public.entry_preview_parts(text) from public;
grant execute on function public.entry_preview_parts(text) to anon, authenticated;
