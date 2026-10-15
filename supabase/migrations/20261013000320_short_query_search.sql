-- =============================================================================
-- Short and broad search queries stay cheap and bounded
-- =============================================================================
--
-- A query of one or two letters, or a word nearly every text contains, made
-- the database read every chapter of every topic:
--
-- * search() (the site search) ranked every matching chapter (ts_rank reads
--   the chapter's whole search vector), and the planner preferred reading
--   every chapter's vector over the GIN index — it doesn't count reading the
--   out-of-line vectors.
-- * search_topics() (the Topics page; words of two letters and more) scored
--   every matching part with topic_hit_score(), which unnests the part's whole
--   vector — "wa" scored every chapter. Introductions weren't even matched
--   from their index: the planner took the published-list index and rebuilt
--   every topic's text from its HTML (topic_intro_search() looked cheap).
--
-- Now:
--
-- 1. search() answers at once when the text has no word of at least three
--    characters (no branch can match without one: search_query()), and
--    search_topics() when it has none of two. Both are PL/pgSQL so that this
--    happens before any query is planned, and the rest is planned with the
--    actual query. The app doesn't ask search() for such a text at all
--    (isSearchable(), src/lib/search-query.ts).
-- 2. Matching comes from the GIN indexes, which read no text: both functions
--    plan with bitmap index scans only (enable_seqscan and enable_indexscan
--    off — the planner prices a GIN prefix lookup far above a scan that reads
--    every chapter's vector, as it doesn't count reading out-of-line values),
--    and topic_intro_search() is declared as expensive as it is.
-- 3. Ranking is bounded. Of the matching chapters (search(): 200) or parts
--    (search_topics(): 100) only that many are ranked: those whose heading
--    holds a query word first, then by topic title, slug and page order —
--    all read from the row itself, not from the text. With fewer matches than
--    that everything is ranked exactly as before, so ordinary queries return
--    the same rows, ranks and order; a query matching more is ranked among
--    the first of them instead of all of them.
-- 4. search() ranks chapters only of topics it didn't already find by their
--    own text or country — those keep their own rank, as before.
--
-- Tests: topic-search, db-low-findings and search-helpers-hardening compare
-- both functions with their previous versions on the same data;
-- short-query-search bounds the work and the time on a few hundred chapters.
--
-- Security: unchanged — both stay security definer (20261013000210) and read
-- published originals only, filtered in the function itself.
-- =============================================================================

-- Rebuilding a topic's introduction text from its HTML takes milliseconds,
-- not microseconds: with this the planner matches introductions from the
-- index entries_topic_intro_search instead of rebuilding every one.
alter function public.topic_intro_search(text, text, text) cost 100000;

-- ---------------------------------------------------------------------------
-- 1. search()
-- ---------------------------------------------------------------------------

create or replace function public.search(p_text text, p_limit integer default 12)
returns table (id text, kind text, title text, subtitle text, url text, rank real)
language plpgsql stable
security definer
set search_path = public, pg_temp
set enable_seqscan = off
set enable_indexscan = off
as $$
#variable_conflict use_column
declare
  v_query tsquery := search_query(p_text);
  v_words text[];
  v_chapter_query tsquery;
  v_heading text;
begin
  -- Every kind of hit needs a word of at least three characters.
  if v_query is null then
    return;
  end if;
  -- Chapters are indexed folded, so they are asked with the folded words.
  v_words := search_words(p_text);
  v_chapter_query := prefix_tsquery(v_words);
  -- A heading that holds one of the words (words are letters and digits only).
  v_heading := '\m(' || array_to_string(v_words, '|') || ')';

  return query
  with
  -- Entries tagged with a country whose name matches (ranked at least 0.5).
  country_hits as (
    select distinct ec.entry_id
    from entry_countries ec join countries c on c.iso3 = ec.country_iso3
    where to_tsvector('simple', c.name) @@ v_query
  ),
  -- Entries whose own text matches (GIN index entries_search).
  text_hits as (
    select e.id from entries e where e.search @@ v_query
  ),
  direct_hits as (
    select th.id as entry_id from text_hits th
    union
    select ch.entry_id from country_hits ch
  ),
  -- Chapters of published topics not found above (GIN index
  -- entry_chapters_search; reads no text). At most 200 get ranked.
  chapter_candidates as (
    select c.id
    from entry_chapters c join entries e on e.id = c.entry_id
    where c.search @@ v_chapter_query
      and e.status = 'published' and e.translation_of is null
      and not exists (select 1 from direct_hits d where d.entry_id = c.entry_id)
    order by c.title ~* v_heading desc, e.title, e.slug, c.position
    limit 200
  ),
  chapter_hits as (
    select c.entry_id, max(ts_rank(c.search, v_chapter_query)) as rank
    from entry_chapters c
    where c.id in (select cc.id from chapter_candidates cc)
    group by c.entry_id
  ),
  hits as (
    select 'region:' || r.slug as id, 'region' as kind, r.name as title, coalesce(r.tagline, '') as subtitle,
           '/region/' || r.slug as url,
           (ts_rank(to_tsvector('simple', r.name || ' ' || coalesce(r.summary, '')), v_query) + 1.0)::real as rank
    from regions r
    where to_tsvector('simple', r.name || ' ' || coalesce(r.summary, '')) @@ v_query
    union all
    select 'country:' || c.iso3, 'country', c.name, coalesce(rg.name, 'Country'), '/country/' || c.slug,
           (ts_rank(to_tsvector('simple', c.name || ' ' || coalesce(c.name_formal, '')), v_query) + 1.0)::real
    from countries c left join regions rg on rg.slug = c.region_slug
    where c.region_slug is not null
      and to_tsvector('simple', c.name || ' ' || coalesce(c.name_formal, '')) @@ v_query
    union all
    select 'issue:' || s.slug, 'issue', s.name, coalesce(s.subtitle, ''), '/global-issue/' || s.slug,
           (ts_rank(to_tsvector('simple', s.name || ' ' || coalesce(s.summary, '')), v_query) + 0.8)::real
    from special_regions s
    where to_tsvector('simple', s.name || ' ' || coalesce(s.summary, '')) @@ v_query
    union all
    -- Found by their own text or a tagged country.
    select 'news:' || e.slug, 'news', e.title, e.category,
           case when e.kind = 'entry' then '/entry/' else '/news/' end || e.slug,
           greatest(
             ts_rank(e.search, v_query),
             case when e.id in (select ch.entry_id from country_hits ch) then 0.5 else 0 end
           )::real
    from entries e
    where e.status = 'published' and e.translation_of is null
      and e.id in (select d.entry_id from direct_hits d)
    union all
    -- Found only through a chapter: half the best chapter's ts_rank.
    select 'news:' || e.slug, 'news', e.title, e.category,
           case when e.kind = 'entry' then '/entry/' else '/news/' end || e.slug,
           (0.5 * h.rank)::real
    from chapter_hits h join entries e on e.id = h.entry_id
  )
  select * from hits
  order by 6 desc, 3
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
end
$$;

revoke execute on function public.search(text, integer) from public;
grant execute on function public.search(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. search_topics()
-- ---------------------------------------------------------------------------
--
-- As 20261013000010, except that at most 100 matching parts are scored
-- (topic_hit_score() unnests the part's whole vector; an introduction's is
-- rebuilt from its HTML) and the anchor is counted for the results only.

create or replace function public.search_topics(p_text text, p_limit integer default 30)
returns table (slug text, topic_title text, heading text, anchor text, rank real, snippet text)
language plpgsql stable
security definer
set search_path = public, pg_temp
set enable_seqscan = off
set enable_indexscan = off
as $$
#variable_conflict use_column
declare
  v_words text[] := search_words(p_text);
  v_query tsquery := prefix_tsquery(search_words(p_text));
  v_heading text;
begin
  -- No word of at least two characters: nothing to look for.
  if v_query is null then
    return;
  end if;
  -- A heading that holds one of the words (words are letters and digits only).
  v_heading := '\m(' || array_to_string(v_words, '|') || ')';

  return query
  with
  -- Every matching part, from the indexes (entries_topic_intro_search,
  -- entry_chapters_search); no text is read here.
  parts as (
    select e.id as entry_id, null::uuid as chapter_id, e.slug, e.title as topic_title,
           e.title as heading, -1 as position
    from entries e
    where e.kind = 'entry' and e.status = 'published' and e.translation_of is null
      and topic_intro_search(e.title, e.summary, e.body_html) @@ v_query
    union all
    select c.entry_id, c.id, e.slug, e.title, c.title, c.position
    from entry_chapters c join entries e on e.id = c.entry_id
    where c.search @@ v_query
      and e.kind = 'entry' and e.status = 'published' and e.translation_of is null
  ),
  -- At most 100 get scored: a query word in the heading first (worth 5 in the
  -- score), then in the order of the results. Materialized, so that each is
  -- scored once.
  scored as materialized (
    select p.entry_id, p.chapter_id, p.slug, p.topic_title, p.heading, p.position,
           case when p.chapter_id is null
                then (select topic_hit_score(topic_intro_search(e.title, e.summary, e.body_html), v_words)
                        from entries e where e.id = p.entry_id)
                else (select topic_hit_score(c.search, v_words)
                        from entry_chapters c where c.id = p.chapter_id)
           end as score
    from (select * from parts p
          order by p.heading ~* v_heading desc, p.topic_title, p.slug, p.position
          limit 100) p
  ),
  hits as (
    select * from scored s
    order by s.score desc, s.topic_title, s.slug, s.position
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  )
  select h.slug, h.topic_title, h.heading,
         -- Chapters counted in page order, as the topic page does (`topic-1`
         -- is the first).
         case when h.chapter_id is not null
              then 'topic-' || (select count(*) from entry_chapters o
                                 where o.entry_id = h.entry_id and o.position <= h.position)
         end,
         h.score,
         search_snippet(
           case when h.chapter_id is null
                then (select concat_ws(' ', nullif(e.summary, ''), nullif(html_plain_text(e.body_html), ''))
                        from entries e where e.id = h.entry_id)
                else (select html_plain_text(c.body_html) from entry_chapters c where c.id = h.chapter_id)
           end,
           v_words)
  from hits h
  order by h.score desc, h.topic_title, h.slug, h.position;
end
$$;

revoke execute on function public.search_topics(text, integer) from public;
grant execute on function public.search_topics(text, integer) to anon, authenticated;
