-- =============================================================================
-- Dossiers: topics, configurable "Learn more" tiles, SEO & GEO (G4 extension)
-- =============================================================================
--
-- An encyclopedia entry (`entries.kind = 'entry'`) is presented as a dossier:
-- the left half holds topic tiles (rows of `entry_chapters`, the illustration
-- is the tile photo), the right half holds "Learn more" tiles.
--
-- 1. `learn_more_tiles`: the tiles themselves. `entry_id is null` = a default
--    tile shown on every dossier (the five original resource kinds are seeded
--    as defaults); `entry_id` set = a custom tile of that one dossier.
-- 2. `resources.tile_id`: which tile a link belongs to. `kind` stays for
--    regions / global issues (expand phase); a trigger keeps the two in sync
--    for the five legacy kinds.
-- 3. `entry_tile_notes`: free rich-text content of a tile in one dossier
--    (e.g. hand-written notes), next to or instead of the links.
-- 4. SEO & GEO columns on `entries` and `entry_faq`. Every field is optional:
--    the app derives good defaults (title, summary, summary points, topics)
--    and the writer may override them.
-- 5. Up to 12 topics per dossier (two columns of tiles).
-- =============================================================================

-- Same check as the chapter / resource policies of an entry: the caller may
-- edit the entry, and a published one only with the right to approve it.
create or replace function public.can_write_entry(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from entries e
                  where e.id = p_entry and can_edit_entry(e.owner_id)
                    and (e.status <> 'published' or can_approve_entry(e.id)))
$$;

-- Readable part of an entry: published, or unpublished for those who may see it.
create or replace function public.can_read_entry(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from entries e
                  where e.id = p_entry
                    and (e.status = 'published'
                         or (auth.uid() is not null and can_read_unpublished(e.owner_id))))
$$;

revoke execute on function public.can_write_entry(uuid) from public, anon;
grant execute on function public.can_write_entry(uuid) to authenticated;
revoke execute on function public.can_read_entry(uuid) from public;
grant execute on function public.can_read_entry(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Learn-more tiles
-- ---------------------------------------------------------------------------

create table public.learn_more_tiles (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid references public.entries (id) on delete cascade,
  slug          text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  label         text not null check (length(btrim(label)) between 1 and 60),
  description   text not null default '' check (length(description) <= 200),
  icon          text not null default 'link' check (icon in (
                  'video', 'chart', 'book', 'graduation', 'mic', 'pen', 'map', 'link', 'file', 'globe')),
  image_url     text check (image_url is null or (image_url ~ '^https://' and length(image_url) <= 1000)),
  image_credit  text check (length(image_credit) <= 300),
  position      integer not null default 0 check (position between 0 and 99),
  -- One of the five original resource kinds, for the seeded default tiles.
  legacy_kind   text unique check (legacy_kind in (
                  'Videos & Documentaries', 'Lectures & Debates', 'Articles, Reports & Books',
                  'Educational Resources', 'Statistics & Infographics')),
  updated_at    timestamptz not null default now(),
  check (legacy_kind is null or entry_id is null)
);

-- A slug is unique among the defaults and within one dossier.
create unique index learn_more_tiles_default_slug on public.learn_more_tiles (slug) where entry_id is null;
create unique index learn_more_tiles_entry_slug on public.learn_more_tiles (entry_id, slug) where entry_id is not null;
create index learn_more_tiles_entry on public.learn_more_tiles (entry_id, position);

create trigger learn_more_tiles_stamp before update on public.learn_more_tiles
  for each row execute function public.stamp_row();

insert into public.learn_more_tiles (slug, label, icon, position, legacy_kind) values
  ('videos', 'Videos & Documentaries', 'video', 0, 'Videos & Documentaries'),
  ('stats', 'Stats, Databases & Infographics', 'chart', 1, 'Statistics & Infographics'),
  ('reading', 'Articles, Reports & Books', 'book', 2, 'Articles, Reports & Books'),
  ('education', 'Educational Resources', 'graduation', 3, 'Educational Resources'),
  ('lectures', 'Lectures & Debates', 'mic', 4, 'Lectures & Debates');

alter table public.learn_more_tiles enable row level security;

-- Default tiles are part of the site's frame; custom ones follow their dossier.
create policy learn_more_tiles_public on public.learn_more_tiles for select to anon
  using (entry_id is null or public.can_read_entry(entry_id));
create policy learn_more_tiles_read on public.learn_more_tiles for select to authenticated
  using (entry_id is null or public.can_read_entry(entry_id));
-- A default tile appears on every dossier, so it needs the right over all
-- articles (`can_edit_entry(null)` = news scope "all").
create policy learn_more_tiles_add on public.learn_more_tiles for insert to authenticated
  with check (case when entry_id is null then has_perm('news', 'c') and can_edit_entry(null)
                   else public.can_write_entry(entry_id) end);
create policy learn_more_tiles_change on public.learn_more_tiles for update to authenticated
  using (case when entry_id is null then has_perm('news', 'e') and can_edit_entry(null)
              else public.can_write_entry(entry_id) end)
  with check (case when entry_id is null then has_perm('news', 'e') and can_edit_entry(null)
                   else public.can_write_entry(entry_id) end);
create policy learn_more_tiles_remove on public.learn_more_tiles for delete to authenticated
  using (case when entry_id is null then has_perm('news', 'd') and can_edit_entry(null) and legacy_kind is null
              else public.can_write_entry(entry_id) end);

grant select on public.learn_more_tiles to anon;
grant select, insert, update, delete on public.learn_more_tiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Resources belong to a tile
-- ---------------------------------------------------------------------------

alter table public.resources
  add column tile_id uuid references public.learn_more_tiles (id) on delete cascade,
  alter column kind drop not null,
  add constraint resources_kind_or_tile check (kind is not null or tile_id is not null);
create index resources_tile on public.resources (tile_id);
grant select (tile_id) on public.resources to anon;

update public.resources r set tile_id = t.id
  from public.learn_more_tiles t
 where t.legacy_kind = r.kind and r.tile_id is null;

-- Legacy kind → its default tile and back, so old and new writers agree.
-- A tile of another dossier is refused (a link may only use its own tiles).
create or replace function public.sync_resource_tile()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tile learn_more_tiles%rowtype;
begin
  if new.tile_id is null and new.kind is not null then
    select id into new.tile_id from learn_more_tiles where legacy_kind = new.kind;
  elsif new.tile_id is not null then
    select * into v_tile from learn_more_tiles where id = new.tile_id;
    if v_tile.entry_id is not null and v_tile.entry_id is distinct from new.entry_id then
      raise exception 'This tile belongs to another dossier.' using errcode = '23514';
    end if;
    new.kind := coalesce(v_tile.legacy_kind, new.kind);
  end if;
  return new;
end;
$$;

create trigger resources_tile before insert or update of kind, tile_id on public.resources
  for each row execute function public.sync_resource_tile();

-- ---------------------------------------------------------------------------
-- 3. Rich-text content of a tile in one dossier
-- ---------------------------------------------------------------------------

create table public.entry_tile_notes (
  entry_id    uuid not null references public.entries (id) on delete cascade,
  tile_id     uuid not null references public.learn_more_tiles (id) on delete cascade,
  -- Editor HTML, sanitized on the server before saving and before rendering.
  body_html   text not null default '' check (length(body_html) <= 100000),
  updated_at  timestamptz not null default now(),
  primary key (entry_id, tile_id)
);
create index entry_tile_notes_tile on public.entry_tile_notes (tile_id);
create trigger entry_tile_notes_stamp before update on public.entry_tile_notes
  for each row execute function public.stamp_row();

alter table public.entry_tile_notes enable row level security;
create policy entry_tile_notes_public on public.entry_tile_notes for select to anon
  using (public.can_read_entry(entry_id));
create policy entry_tile_notes_read on public.entry_tile_notes for select to authenticated
  using (public.can_read_entry(entry_id));
-- A note may only sit on a default tile or on a tile of the same dossier.
create policy entry_tile_notes_add on public.entry_tile_notes for insert to authenticated
  with check (public.can_write_entry(entry_id)
              and exists (select 1 from learn_more_tiles t
                           where t.id = tile_id and (t.entry_id is null or t.entry_id = entry_tile_notes.entry_id)));
create policy entry_tile_notes_change on public.entry_tile_notes for update to authenticated
  using (public.can_write_entry(entry_id))
  with check (public.can_write_entry(entry_id)
              and exists (select 1 from learn_more_tiles t
                           where t.id = tile_id and (t.entry_id is null or t.entry_id = entry_tile_notes.entry_id)));
create policy entry_tile_notes_remove on public.entry_tile_notes for delete to authenticated
  using (public.can_write_entry(entry_id));

grant select on public.entry_tile_notes to anon;
grant select, insert, update, delete on public.entry_tile_notes to authenticated;

-- ---------------------------------------------------------------------------
-- 4. SEO & GEO
-- ---------------------------------------------------------------------------

alter table public.entries
  add column seo_title text check (length(seo_title) <= 70),
  add column seo_description text check (length(seo_description) <= 170),
  add column og_image_url text check (og_image_url is null or (og_image_url ~ '^https://' and length(og_image_url) <= 1000)),
  add column seo_keywords text[] not null default '{}'
    constraint entries_seo_keywords_short check (public.short_items(seo_keywords, 12, 60)),
  -- GEO: a self-contained answer generative engines can quote (2–4 sentences).
  add column geo_summary text check (length(geo_summary) <= 800),
  add column noindex boolean not null default false;

grant select (seo_title, seo_description, og_image_url, seo_keywords, geo_summary, noindex)
  on public.entries to anon;

-- FAQ of a dossier: shown on the page and emitted as FAQPage JSON-LD.
create table public.entry_faq (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries (id) on delete cascade,
  position   integer not null check (position between 0 and 19),
  question   text not null check (length(btrim(question)) between 1 and 300),
  answer     text not null check (length(btrim(answer)) between 1 and 2000),
  unique (entry_id, position)
);

alter table public.entry_faq enable row level security;
create policy entry_faq_public on public.entry_faq for select to anon
  using (public.can_read_entry(entry_id));
create policy entry_faq_read on public.entry_faq for select to authenticated
  using (public.can_read_entry(entry_id));
create policy entry_faq_add on public.entry_faq for insert to authenticated
  with check (public.can_write_entry(entry_id));
create policy entry_faq_change on public.entry_faq for update to authenticated
  using (public.can_write_entry(entry_id)) with check (public.can_write_entry(entry_id));
create policy entry_faq_remove on public.entry_faq for delete to authenticated
  using (public.can_write_entry(entry_id));

grant select on public.entry_faq to anon;
grant select, insert, update, delete on public.entry_faq to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Topics: up to 12, saved with the new parts in one call
-- ---------------------------------------------------------------------------

alter table public.entry_chapters drop constraint entry_chapters_position_range;
alter table public.entry_chapters
  add constraint entry_chapters_position_range check (position between 0 and 11);

create or replace function public.replace_entry_parts(p_entry uuid, p_part text, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
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
    delete from entry_chapters where entry_id = p_entry;
    insert into entry_chapters (entry_id, position, title, summary_points, body_html,
                                illustration_url, illustration_credit, audio_url)
    select p_entry, (ord - 1)::int, i ->> 'title',
           coalesce(array(select jsonb_array_elements_text(coalesce(i -> 'summary_points', '[]'))), '{}'),
           coalesce(i ->> 'body_html', ''),
           nullif(i ->> 'illustration_url', ''), nullif(i ->> 'illustration_credit', ''),
           nullif(i ->> 'audio_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'resources' then
    if jsonb_array_length(p_items) > 50 then
      raise exception 'A dossier holds at most 50 resources.' using errcode = '22023';
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

revoke execute on function public.replace_entry_parts(uuid, text, jsonb) from public, anon;
grant execute on function public.replace_entry_parts(uuid, text, jsonb) to authenticated;
