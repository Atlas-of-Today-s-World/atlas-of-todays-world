-- =============================================================================
-- search(): entry hits without OR-ed subquery (review 2026-10-07, D-L1)
-- =============================================================================
--
-- The news/entry branch of search() matched rows with
--   e.search @@ query OR exists (entry linked to a country whose name matches)
-- An OR with a correlated subquery can't be answered from the GIN index
-- `entries_search`, so every search read the whole entries table and ran the
-- subquery per row. Now the two ways an entry can match are separate sets —
-- a GIN lookup and a lookup of matching countries — and only their union is
-- read from `entries`. Results, ranks and order are identical (test
-- supabase/tests/db-low-findings.test.mjs compares both versions on the seed).
-- Still security invoker: RLS decides what each caller finds.
-- =============================================================================

create or replace function public.search(p_text text, p_limit integer default 12)
returns table (id text, kind text, title text, subtitle text, url text, rank real)
language sql stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (select search_query(p_text) as query),
  -- Entries tagged with a country whose name matches (ranked at least 0.5).
  country_hits as (
    select distinct ec.entry_id
    from entry_countries ec join countries c on c.iso3 = ec.country_iso3, q
    where q.query is not null and to_tsvector('simple', c.name) @@ q.query
  ),
  -- Entries whose own text matches (GIN index entries_search).
  text_hits as (
    select e.id
    from entries e, q
    where q.query is not null and e.search @@ q.query
  ),
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
             case when e.id in (select ch.entry_id from country_hits ch) then 0.5 else 0 end
           )::real
    from entries e, q
    where q.query is not null and e.status = 'published' and e.translation_of is null
      and e.id in (select th.id from text_hits th
                   union
                   select ch.entry_id from country_hits ch)
  )
  select * from hits
  order by 6 desc, 3
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;

-- create or replace keeps the existing grants (anon, authenticated); restated
-- so this file reads complete on its own.
revoke execute on function public.search(text, integer) from public;
grant execute on function public.search(text, integer) to anon, authenticated;
