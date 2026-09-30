-- =============================================================================
-- Fulltext v Postgresu (ADR-005, PLAN B5)
-- =============================================================================
--
-- Nahrazuje MiniSearch v paměti procesu: index je jeden, sdílený všemi
-- instancemi a vždy aktuální. Konfigurace 'simple' (bez stemmingu) — obsah je
-- anglický i vícejazyčný a hledají se hlavně vlastní jména.
-- Funkce běží s právy volajícího, takže RLS rozhoduje, co kdo najde.
-- =============================================================================

alter table public.entries add column search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(regexp_replace(body_html, '<[^>]+>', ' ', 'g'), '')), 'C')
  ) stored;
create index entries_search on public.entries using gin (search);

-- Anonym sloupec potřebuje pro vyhledávání (je odvozený z veřejných sloupců).
grant select (search) on public.entries to anon;

-- Dotaz z libovolného textu: slova → prefixové termy spojené AND.
create or replace function public.search_query(p_text text)
returns tsquery
language sql immutable
set search_path = public, pg_temp
as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(quote_literal(word) || ':*', ' & ')) end
  from (
    select distinct lower(word) as word
    from regexp_split_to_table(left(coalesce(p_text, ''), 200), '[^[:alnum:]]+') as word
    where length(word) >= 2
    limit 8
  ) words;
$$;

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
           ts_rank(e.search, q.query)
    from entries e, q
    where q.query is not null and e.status = 'published' and e.search @@ q.query
  )
  select * from hits
  order by 6 desc, 3
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;

revoke execute on function public.search(text, integer) from public;
grant execute on function public.search(text, integer), public.search_query(text) to anon, authenticated;
