-- =============================================================================
-- Jazykové verze novinek a hesel (PLAN G5.3)
-- =============================================================================
--
-- Překlad je samostatný řádek `entries` se stejným slugem a druhem jako
-- originál, jiným `locale` a `translation_of` = id originálu. Má vlastní
-- workflow (koncept → schválení → zveřejnění), revize, náhled i plánování —
-- nic z toho se kvůli jazykům nemění.
--
--   /news/{slug}     → originál (en)
--   /cs/news/{slug}  → zveřejněný český překlad, jinak originál s poznámkou
--
-- Slug je proto unikátní jen v rámci jazyka. Trigger hlídá, že překlad
-- ukazuje na originál (ne na jiný překlad), sedí slugem a druhem a nemění
-- se, ke kterému originálu patří. Změna slugu originálu se propíše do překladů.
-- =============================================================================

alter table public.entries
  add column translation_of uuid references public.entries (id) on delete cascade;
create index entries_translation_of on public.entries (translation_of);

alter table public.entries drop constraint entries_slug_key;
alter table public.entries add constraint entries_slug_locale_key unique (slug, locale);
alter table public.entries add constraint entries_translation_locale_key unique (translation_of, locale);

-- Veřejné sloupce (DB-08): anon čte jen vyjmenované.
grant select (translation_of) on public.entries to anon;

-- ---------------------------------------------------------------------------
-- 1. Pravidla překladu
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER: čte originál, který volající přes RLS vidět nemusí
-- (překladatel cizího zveřejněného článku) — jinak by se kontrola tiše přeskočila.
create or replace function public.guard_entry_translation()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_original entries%rowtype;
begin
  if tg_op = 'UPDATE' and new.translation_of is distinct from old.translation_of then
    raise exception 'A translation cannot be moved to another original.' using errcode = '42501';
  end if;
  if new.translation_of is null then
    return new;
  end if;
  select * into v_original from entries where id = new.translation_of;
  if not found or v_original.translation_of is not null then
    raise exception 'A translation must point to an original entry.' using errcode = '23514';
  end if;
  if new.slug <> v_original.slug or new.kind <> v_original.kind or new.locale = v_original.locale then
    raise exception 'A translation keeps the slug and kind of its original, in another language.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger entries_translation_guard
  before insert or update of translation_of, slug, kind, locale on public.entries
  for each row execute function public.guard_entry_translation();

-- Nový slug originálu (koncept) dostanou i jeho překlady.
create or replace function public.follow_original_slug()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update entries set slug = new.slug where translation_of = new.id and slug <> new.slug;
  return new;
end;
$$;

create trigger entries_translation_slug
  after update of slug on public.entries
  for each row when (old.slug is distinct from new.slug and new.translation_of is null)
  execute function public.follow_original_slug();

revoke execute on function public.guard_entry_translation() from public, anon, authenticated;
revoke execute on function public.follow_original_slug() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Založení překladu z originálu
-- ---------------------------------------------------------------------------
-- security invoker: kopíruje pod RLS volajícího — přeložit smí, kdo smí psát
-- (entries_add: news „c", vlastní koncept). Text se zkopíruje jako výchozí
-- bod k přeložení; zařazení (region, země, kategorie, obálka) převezme.

create or replace function public.create_entry_translation(p_entry uuid, p_locale text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_locale is null or p_locale !~ '^[a-z]{2}$' then
    raise exception 'Unknown language.' using errcode = '22023';
  end if;

  insert into entries (slug, kind, locale, title, summary, summary_points, category, region_slug,
                       special_slug, area_id, cover_url, cover_credit, body_html, author_name,
                       author_id, reading_minutes, owner_id, status, translation_of)
  select e.slug, e.kind, p_locale, e.title, e.summary, e.summary_points, e.category, e.region_slug,
         e.special_slug, e.area_id, e.cover_url, e.cover_credit, e.body_html, e.author_name,
         e.author_id, e.reading_minutes, auth.uid(), 'draft', e.id
  from entries e
  where e.id = p_entry and e.translation_of is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Only an original entry you can read can be translated.' using errcode = '42501';
  end if;

  insert into entry_countries (entry_id, country_iso3)
  select v_id, country_iso3 from entry_countries where entry_id = p_entry;

  insert into entry_chapters (entry_id, position, title, summary_points, body_html,
                              illustration_url, illustration_credit, audio_url)
  select v_id, position, title, summary_points, body_html, illustration_url, illustration_credit,
         -- Zvuk je v jazyce originálu — překlad ho nedědí.
         null
  from entry_chapters where entry_id = p_entry;

  insert into resources (entry_id, position, kind, title, source, description, url, image_url)
  select v_id, position, kind, title, source, description, url, image_url
  from resources where entry_id = p_entry;

  return v_id;
end;
$$;

revoke execute on function public.create_entry_translation(uuid, text) from public, anon;
grant execute on function public.create_entry_translation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vyhledávání a plánovaná hesla jen z originálů
-- ---------------------------------------------------------------------------
-- Překlad by ve výsledcích byl podruhé se stejnou adresou. Heslo (kind
-- 'entry') vede na /entry/…, ne na /news/… (oprava z G4).

create or replace function public.search(p_text text, p_limit integer default 12)
returns table (id text, kind text, title text, subtitle text, url text, rank real)
language sql stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (select search_query(p_text) as query),
  hits as (
    select 'region:' || r.slug as id, 'region' as kind, r.name as title, coalesce(r.tagline, '') as subtitle,
           '/region/' || r.slug as url,
           (ts_rank(to_tsvector('simple', r.name || ' ' || coalesce(r.summary, '')), q.query) + 1.0)::real as rank
    from regions r, q
    where q.query is not null and to_tsvector('simple', r.name || ' ' || coalesce(r.summary, '')) @@ q.query
    union all
    select 'country:' || c.iso3, 'country', c.name, coalesce(rg.name, 'Country'), '/country/' || c.slug,
           (ts_rank(to_tsvector('simple', c.name || ' ' || coalesce(c.name_formal, '')), q.query) + 1.0)::real
    from countries c left join regions rg on rg.slug = c.region_slug, q
    where q.query is not null and c.region_slug is not null
      and to_tsvector('simple', c.name || ' ' || coalesce(c.name_formal, '')) @@ q.query
    union all
    select 'issue:' || s.slug, 'issue', s.name, coalesce(s.subtitle, ''), '/global-issue/' || s.slug,
           (ts_rank(to_tsvector('simple', s.name || ' ' || coalesce(s.summary, '')), q.query) + 0.8)::real
    from special_regions s, q
    where q.query is not null and to_tsvector('simple', s.name || ' ' || coalesce(s.summary, '')) @@ q.query
    union all
    select 'news:' || e.slug, 'news', e.title, e.category,
           case when e.kind = 'entry' then '/entry/' else '/news/' end || e.slug,
           greatest(
             ts_rank(e.search, q.query),
             case when exists (
               select 1 from entry_countries ec join countries c on c.iso3 = ec.country_iso3
               where ec.entry_id = e.id and to_tsvector('simple', c.name) @@ q.query) then 0.5 else 0 end
           )::real
    from entries e, q
    where q.query is not null and e.status = 'published' and e.translation_of is null
      and (e.search @@ q.query
           or exists (
             select 1 from entry_countries ec join countries c on c.iso3 = ec.country_iso3
             where ec.entry_id = e.id and to_tsvector('simple', c.name) @@ q.query))
  )
  select * from hits
  order by 6 desc, 3
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;

create or replace function public.planned_entries()
returns table (
  title         text,
  category      text,
  region_slug   text,
  special_slug  text,
  countries     text[]
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.title, e.category, e.region_slug, e.special_slug,
         coalesce((select array_agg(c.country_iso3 order by c.country_iso3)
                     from entry_countries c where c.entry_id = e.id), '{}')
  from entries e
  where e.kind = 'entry' and e.status = 'planned' and e.translation_of is null
  order by e.title
  limit 500
$$;
