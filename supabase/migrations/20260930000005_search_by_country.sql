-- =============================================================================
-- Vyhledávání najde článek i podle zemí, ke kterým patří
-- =============================================================================
-- „Russia" má najít i heslo o Putinově režimu, i když slovo v textu není —
-- stejně jako dosavadní MiniSearch, který měl názvy zemí v indexu článku.

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
    select 'news:' || e.slug, 'news', e.title, e.category, '/news/' || e.slug,
           greatest(
             ts_rank(e.search, q.query),
             case when exists (
               select 1 from entry_countries ec join countries c on c.iso3 = ec.country_iso3
               where ec.entry_id = e.id and to_tsvector('simple', c.name) @@ q.query) then 0.5 else 0 end
           )::real
    from entries e, q
    where q.query is not null and e.status = 'published'
      and (e.search @@ q.query
           or exists (
             select 1 from entry_countries ec join countries c on c.iso3 = ec.country_iso3
             where ec.entry_id = e.id and to_tsvector('simple', c.name) @@ q.query))
  )
  select * from hits
  order by 6 desc, 3
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;

revoke execute on function public.search(text, integer) from public;
grant execute on function public.search(text, integer) to anon, authenticated;
