-- =============================================================================
-- Topics: tile templates, own tiles per topic, map layers (ADR-024)
-- =============================================================================
--
-- A topic is an encyclopedia entry (`entries.kind = 'entry'`, shown as a
-- dossier): article tiles (`entry_chapters`) and "Learn more" resource tiles.
--
-- 1. `topic_templates` + `topic_template_tiles`: named sets of resource tiles
--    with the section labels. Exactly one template is the default; the five
--    original resource kinds become the "Standard" default template.
-- 2. Every topic owns its tiles. A new topic gets a copy of the default
--    template (trigger); `apply_topic_template()` re-applies any template to an
--    existing topic (matching tiles by slug keep their links).
--    The old shared tiles (`entry_id is null`) stay only as the mapping of the
--    legacy resource kinds of regions / global issues; nobody reads them any
--    more (expand phase — the running app then shows just the topic's tiles).
-- 3. Tile looks: more icons, a background colour next to the photo, for
--    resource tiles and article tiles alike; section labels per topic.
-- 4. `entries.map_layers`: on which globe layers (countries / regions /
--    global issues) a topic is counted.
-- 5. Up to 200 links per topic (the old site's topics have up to 80).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3a. Icons and colours (shared checks)
-- ---------------------------------------------------------------------------

create or replace function public.is_tile_icon(p_icon text)
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select p_icon in ('video', 'chart', 'book', 'graduation', 'mic', 'pen', 'map', 'link', 'file',
                    'globe', 'podcast', 'image', 'news', 'people', 'landmark', 'scale', 'idea',
                    'database', 'calendar', 'quote', 'heart', 'leaf', 'shield', 'flag')
$$;

create or replace function public.is_hex_color(p_value text)
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select p_value is null or p_value ~ '^#[0-9a-fA-F]{6}$'
$$;

grant execute on function public.is_tile_icon(text), public.is_hex_color(text) to anon, authenticated;

alter table public.learn_more_tiles drop constraint learn_more_tiles_icon_check;
alter table public.learn_more_tiles
  add constraint learn_more_tiles_icon_check check (public.is_tile_icon(icon)),
  add column background text constraint learn_more_tiles_background_hex check (public.is_hex_color(background));

alter table public.entry_chapters
  add column tile_background text
    constraint entry_chapters_tile_background_hex check (public.is_hex_color(tile_background));

-- ---------------------------------------------------------------------------
-- 1. Templates
-- ---------------------------------------------------------------------------

create table public.topic_templates (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique check (length(btrim(name)) between 1 and 80),
  description       text not null default '' check (length(description) <= 300),
  is_default        boolean not null default false,
  articles_label    text not null default 'Articles' check (length(btrim(articles_label)) between 1 and 40),
  learn_more_label  text not null default 'Learn more' check (length(btrim(learn_more_label)) between 1 and 40),
  updated_at        timestamptz not null default now()
);
-- At most one default; the app keeps exactly one (set_default_topic_template).
create unique index topic_templates_one_default on public.topic_templates (is_default) where is_default;
create trigger topic_templates_stamp before update on public.topic_templates
  for each row execute function public.stamp_row();

create table public.topic_template_tiles (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.topic_templates (id) on delete cascade,
  slug          text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  label         text not null check (length(btrim(label)) between 1 and 60),
  description   text not null default '' check (length(description) <= 200),
  icon          text not null default 'link' check (public.is_tile_icon(icon)),
  image_url     text check (image_url is null or (image_url ~ '^https://' and length(image_url) <= 1000)),
  image_credit  text check (length(image_credit) <= 300),
  background    text check (public.is_hex_color(background)),
  position      integer not null default 0 check (position between 0 and 99),
  unique (template_id, slug)
);
create index topic_template_tiles_template on public.topic_template_tiles (template_id, position);

alter table public.topic_templates enable row level security;
alter table public.topic_template_tiles enable row level security;

-- Templates are an editorial tool: readable by whoever may write articles,
-- changed by whoever has the right over all articles (as the old default tiles).
create policy topic_templates_read on public.topic_templates for select to authenticated
  using (has_perm('news', 'c') or has_perm('news', 'e'));
create policy topic_templates_add on public.topic_templates for insert to authenticated
  with check (has_perm('news', 'c') and can_edit_entry(null));
create policy topic_templates_change on public.topic_templates for update to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null))
  with check (has_perm('news', 'e') and can_edit_entry(null));
create policy topic_templates_remove on public.topic_templates for delete to authenticated
  using (has_perm('news', 'd') and can_edit_entry(null) and not is_default);

create policy topic_template_tiles_read on public.topic_template_tiles for select to authenticated
  using (has_perm('news', 'c') or has_perm('news', 'e'));
create policy topic_template_tiles_add on public.topic_template_tiles for insert to authenticated
  with check (has_perm('news', 'e') and can_edit_entry(null));
create policy topic_template_tiles_change on public.topic_template_tiles for update to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null))
  with check (has_perm('news', 'e') and can_edit_entry(null));
create policy topic_template_tiles_remove on public.topic_template_tiles for delete to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null));

grant select, insert, update, delete on public.topic_templates, public.topic_template_tiles to authenticated;

-- The five original resource kinds = the "Standard" default template.
with standard as (
  insert into public.topic_templates (name, description, is_default)
  values ('Standard', 'The five resource sections of the original Atlas topics.', true)
  returning id
)
insert into public.topic_template_tiles (template_id, slug, label, description, icon, image_url, image_credit, position)
select standard.id, t.slug, t.label, t.description, t.icon, t.image_url, t.image_credit, t.position
  from standard, public.learn_more_tiles t
 where t.entry_id is null
 order by t.position;

-- ---------------------------------------------------------------------------
-- 2. Topics own their tiles
-- ---------------------------------------------------------------------------

alter table public.entries
  add column template_id uuid references public.topic_templates (id) on delete set null,
  add column articles_label text check (length(btrim(articles_label)) between 1 and 40),
  add column learn_more_label text check (length(btrim(learn_more_label)) between 1 and 40),
  add column map_layers text[] not null default '{countries,regions,issues}'
    constraint entries_map_layers_known check (map_layers <@ array['countries', 'regions', 'issues']);
create index entries_template on public.entries (template_id);

grant select (articles_label, learn_more_label, map_layers) on public.entries to anon;

-- Copies a template's tiles into a topic: a tile with the same slug is updated
-- (its links and text stay), a missing one is added; with p_remove_missing the
-- topic's tiles that the template doesn't have are deleted with their links.
-- Internal: called by the trigger and by apply_topic_template after its checks.
create or replace function public.copy_template_tiles(p_entry uuid, p_template uuid, p_remove_missing boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update learn_more_tiles t
     set label = s.label, description = s.description, icon = s.icon, image_url = s.image_url,
         image_credit = s.image_credit, background = s.background, position = s.position
    from topic_template_tiles s
   where s.template_id = p_template and t.entry_id = p_entry and t.slug = s.slug;

  insert into learn_more_tiles (entry_id, slug, label, description, icon, image_url, image_credit, background, position)
  select p_entry, s.slug, s.label, s.description, s.icon, s.image_url, s.image_credit, s.background, s.position
    from topic_template_tiles s
   where s.template_id = p_template
     and not exists (select 1 from learn_more_tiles t where t.entry_id = p_entry and t.slug = s.slug);

  if p_remove_missing then
    delete from learn_more_tiles t
     where t.entry_id = p_entry
       and not exists (select 1 from topic_template_tiles s where s.template_id = p_template and s.slug = t.slug);
  end if;

  update entries e
     set template_id = p_template,
         articles_label = nullif(tp.articles_label, 'Articles'),
         learn_more_label = nullif(tp.learn_more_label, 'Learn more')
    from topic_templates tp
   where e.id = p_entry and tp.id = p_template;
end;
$$;

revoke execute on function public.copy_template_tiles(uuid, uuid, boolean) from public, anon, authenticated;

-- Existing topics: own copies of the shared tiles, their links and notes move along.
do $$
declare
  v_standard uuid := (select id from topic_templates where is_default);
  v_entry uuid;
begin
  for v_entry in select id from entries where kind = 'entry' loop
    perform copy_template_tiles(v_entry, v_standard, false);
  end loop;
end
$$;

update public.resources r
   set tile_id = own.id
  from public.learn_more_tiles shared, public.learn_more_tiles own
 where r.entry_id is not null and r.tile_id = shared.id and shared.entry_id is null
   and own.entry_id = r.entry_id and own.slug = shared.slug;

update public.entry_tile_notes n
   set tile_id = own.id
  from public.learn_more_tiles shared, public.learn_more_tiles own
 where n.tile_id = shared.id and shared.entry_id is null
   and own.entry_id = n.entry_id and own.slug = shared.slug;

-- A new topic (or an article turned into one) starts from the default template.
create or replace function public.entries_default_template()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_template uuid;
begin
  if new.kind <> 'entry' or exists (select 1 from learn_more_tiles where entry_id = new.id) then
    return null;
  end if;
  v_template := coalesce(new.template_id, (select id from topic_templates where is_default));
  if v_template is not null then
    perform copy_template_tiles(new.id, v_template, false);
  end if;
  return null;
end;
$$;

create trigger entries_default_template after insert or update of kind on public.entries
  for each row execute function public.entries_default_template();

-- The shared tiles are no longer shown anywhere: hidden from readers and writers.
drop policy learn_more_tiles_public on public.learn_more_tiles;
drop policy learn_more_tiles_read on public.learn_more_tiles;
drop policy learn_more_tiles_add on public.learn_more_tiles;
drop policy learn_more_tiles_change on public.learn_more_tiles;
drop policy learn_more_tiles_remove on public.learn_more_tiles;
create policy learn_more_tiles_public on public.learn_more_tiles for select to anon
  using (entry_id is not null and public.can_read_entry(entry_id));
create policy learn_more_tiles_read on public.learn_more_tiles for select to authenticated
  using (entry_id is not null and public.can_read_entry(entry_id));
create policy learn_more_tiles_add on public.learn_more_tiles for insert to authenticated
  with check (entry_id is not null and public.can_write_entry(entry_id));
create policy learn_more_tiles_change on public.learn_more_tiles for update to authenticated
  using (entry_id is not null and public.can_write_entry(entry_id))
  with check (entry_id is not null and public.can_write_entry(entry_id));
create policy learn_more_tiles_remove on public.learn_more_tiles for delete to authenticated
  using (entry_id is not null and public.can_write_entry(entry_id));

-- A link written with a legacy kind lands on the topic's tile of the same
-- slug (the topic's copy of the old shared tile); regions / issues keep the
-- shared tile as before.
create or replace function public.sync_resource_tile()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tile learn_more_tiles%rowtype;
  v_shared learn_more_tiles%rowtype;
begin
  if new.tile_id is null and new.kind is not null then
    select * into v_shared from learn_more_tiles where legacy_kind = new.kind;
    if new.entry_id is not null then
      select id into new.tile_id from learn_more_tiles
       where entry_id = new.entry_id and slug = v_shared.slug;
    end if;
    new.tile_id := coalesce(new.tile_id, v_shared.id);
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

-- ---------------------------------------------------------------------------
-- Editor calls
-- ---------------------------------------------------------------------------

-- Re-applies a template to a topic (see copy_template_tiles).
create or replace function public.apply_topic_template(p_entry uuid, p_template uuid, p_remove_missing boolean default false)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_write_entry(p_entry) then
    raise exception 'You may not edit this entry.' using errcode = '42501';
  end if;
  if not (has_perm('news', 'c') or has_perm('news', 'e')) then
    raise exception 'You may not use templates.' using errcode = '42501';
  end if;
  if not exists (select 1 from topic_templates where id = p_template) then
    raise exception 'Unknown template.' using errcode = '22023';
  end if;
  perform copy_template_tiles(p_entry, p_template, p_remove_missing);
end;
$$;

-- Saves the topic's tiles and labels as a new template.
create or replace function public.save_topic_as_template(p_entry uuid, p_name text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.can_read_entry(p_entry) then
    raise exception 'Unknown entry.' using errcode = '22023';
  end if;
  insert into topic_templates (name, articles_label, learn_more_label)
  select btrim(p_name), coalesce(e.articles_label, 'Articles'), coalesce(e.learn_more_label, 'Learn more')
    from entries e where e.id = p_entry
  returning id into v_id;
  insert into topic_template_tiles (template_id, slug, label, description, icon, image_url, image_credit, background, position)
  select v_id, t.slug, t.label, t.description, t.icon, t.image_url, t.image_credit, t.background, t.position
    from learn_more_tiles t where t.entry_id = p_entry;
  return v_id;
end;
$$;

-- Makes one template the default for new topics.
create or replace function public.set_default_topic_template(p_template uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update topic_templates set is_default = false where is_default and id <> p_template;
  update topic_templates set is_default = true where id = p_template;
  if not found then
    raise exception 'You may not change this template.' using errcode = '42501';
  end if;
end;
$$;

-- Saves the tiles of a topic (p_entry) or of a template (p_template) at once:
-- listed tiles with an id are updated, without one added, unlisted deleted
-- (a topic's deleted tile takes its links and text with it).
create or replace function public.replace_tiles(p_entry uuid, p_template uuid, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 24 then
    raise exception 'At most 24 tiles.' using errcode = '22023';
  end if;
  if num_nonnulls(p_entry, p_template) <> 1 then
    raise exception 'Tiles of a topic or of a template.' using errcode = '22023';
  end if;

  if p_entry is not null then
    if not public.can_write_entry(p_entry) then
      raise exception 'You may not edit this entry.' using errcode = '42501';
    end if;
    delete from learn_more_tiles t
     where t.entry_id = p_entry
       and t.id::text not in (select i ->> 'id' from jsonb_array_elements(p_items) i where i ? 'id');
    -- Slugs may swap between tiles: park the kept ones first.
    update learn_more_tiles set slug = 'tmp-' || left(id::text, 8) where entry_id = p_entry;
    update learn_more_tiles t
       set slug = i ->> 'slug', label = i ->> 'label', description = coalesce(i ->> 'description', ''),
           icon = coalesce(i ->> 'icon', 'link'), image_url = nullif(i ->> 'image_url', ''),
           image_credit = nullif(i ->> 'image_credit', ''), background = nullif(i ->> 'background', ''),
           position = (ord - 1)::int
      from jsonb_array_elements(p_items) with ordinality as x(i, ord)
     where t.entry_id = p_entry and t.id::text = i ->> 'id';
    insert into learn_more_tiles (entry_id, slug, label, description, icon, image_url, image_credit, background, position)
    select p_entry, i ->> 'slug', i ->> 'label', coalesce(i ->> 'description', ''), coalesce(i ->> 'icon', 'link'),
           nullif(i ->> 'image_url', ''), nullif(i ->> 'image_credit', ''), nullif(i ->> 'background', ''), (ord - 1)::int
      from jsonb_array_elements(p_items) with ordinality as x(i, ord)
     where not (i ? 'id') or nullif(i ->> 'id', '') is null;
  else
    delete from topic_template_tiles where template_id = p_template;
    insert into topic_template_tiles (template_id, slug, label, description, icon, image_url, image_credit, background, position)
    select p_template, i ->> 'slug', i ->> 'label', coalesce(i ->> 'description', ''), coalesce(i ->> 'icon', 'link'),
           nullif(i ->> 'image_url', ''), nullif(i ->> 'image_credit', ''), nullif(i ->> 'background', ''), (ord - 1)::int
      from jsonb_array_elements(p_items) with ordinality as x(i, ord);
  end if;
end;
$$;

revoke execute on function public.apply_topic_template(uuid, uuid, boolean), public.save_topic_as_template(uuid, text),
  public.set_default_topic_template(uuid), public.replace_tiles(uuid, uuid, jsonb) from public, anon;
grant execute on function public.apply_topic_template(uuid, uuid, boolean), public.save_topic_as_template(uuid, text),
  public.set_default_topic_template(uuid), public.replace_tiles(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. More links per topic; article tiles keep their background colour
-- ---------------------------------------------------------------------------

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
                                illustration_url, illustration_credit, audio_url, tile_background)
    select p_entry, (ord - 1)::int, i ->> 'title',
           coalesce(array(select jsonb_array_elements_text(coalesce(i -> 'summary_points', '[]'))), '{}'),
           coalesce(i ->> 'body_html', ''),
           nullif(i ->> 'illustration_url', ''), nullif(i ->> 'illustration_credit', ''),
           nullif(i ->> 'audio_url', ''), nullif(i ->> 'tile_background', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

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

-- ---------------------------------------------------------------------------
-- Preview by link: the topic's own tiles, notes and labels come along
-- ---------------------------------------------------------------------------

drop function public.entry_preview_parts(text);

create function public.entry_preview_parts(p_token text)
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
                     'position', c.position, 'title', c.title, 'summary_points', c.summary_points,
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
