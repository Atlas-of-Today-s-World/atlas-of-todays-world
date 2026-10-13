-- =============================================================================
-- Topic search in Postgres (search inside topics on /topics; audit D-H3)
-- =============================================================================
--
-- The Topics page searched the plain text of every published topic (intro and
-- all chapters) in JavaScript, loaded from ONE cached item. Next.js doesn't
-- cache items over 2 MB, so as topics grow every search would have read every
-- chapter from the database. Now the database matches, ranks and cuts the
-- excerpt; the app gets at most a page of hits.
--
-- 1. Helpers (pure, immutable):
--    * fold_text()       — lowercase without the common Latin diacritics, one
--                          character per character ("Côte" → "cote"), the same
--                          list as slugify_text() plus a few more. `unaccent`
--                          isn't installed, and folding keeps the old rule that
--                          accents don't matter.
--    * html_plain_text() — body HTML → one line of plain text, as the app's
--                          htmlToText(…, { blockEnd: " ", tagGap: "" }). Only
--                          ever shown as text (React escapes it); not a sanitizer.
--    * search_words()    — query → folded words (≥ 2 characters, at most 8, in
--                          order), prefix_tsquery() → `word:* & word:*`.
--    * topic_search_vector() / topic_intro_search() — heading (weight A) and
--                          text (weight D) of a searchable part.
--    * topic_hit_score() — the old JS score: per word, its occurrences in the
--                          text, +5 when it is in the heading.
--    * search_snippet()  — ~260 characters around the first hit, cut at spaces,
--                          "… " / " …" where text was cut. Plain text; the app
--                          marks the hits and renders it as text.
-- 2. entry_chapters.search: generated tsvector + GIN index; topic intros
--    (title, summary, body of a published original topic) get a partial GIN
--    expression index on entries — no new column there, so revision snapshots
--    and entries' column grants stay as they are.
-- 3. search_topics(p_text, p_limit): one row per matching part (intro or
--    chapter) of a published original topic, best first. Security invoker:
--    anon reads only published rows through RLS, and the function filters on
--    `status = 'published'` itself too.
-- 4. search() (the site search) now also finds a topic by its chapter text.
--    Rows it found before keep their rank and order; a topic found only through
--    a chapter is added with half that chapter's ts_rank.
--
-- Expand-only: the running app keeps working until the new one calls
-- search_topics(). Tests: supabase/tests/topic-search.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.fold_text(p_text text)
returns text
language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select lower(translate(coalesce(p_text, ''),
    'áàâäãåąčćçďđéèêëěęíìîïľĺłňńñóòôöõőøřŕšśşťţúùûüůűýÿžźżğșțāēīōūŭėųįļķģņıÁÀÂÄÃÅĄČĆÇĎĐÉÈÊËĚĘÍÌÎÏĽĹŁŇŃÑÓÒÔÖÕŐØŘŔŠŚŞŤŢÚÙÛÜŮŰÝŸŽŹŻĞȘȚĀĒĪŌŪŬĖŲĮĻĶĢŅİ',
    'aaaaaaacccddeeeeeeiiiilllnnnooooooorrsssttuuuuuuyyzzzgstaeiouueuilkgniaaaaaaacccddeeeeeeiiiilllnnnooooooorrsssttuuuuuuyyzzzgstaeiouueuilkgni'))
$$;

create or replace function public.html_plain_text(p_html text)
returns text
language plpgsql immutable parallel safe cost 1000
set search_path = public, pg_temp
as $$
declare
  v_text text := coalesce(p_html, '');
  v_before text;
  v_entity text;
  v_code integer;
begin
  -- Scripts, styles and comments aren't text.
  v_text := regexp_replace(v_text, '<script\M.*?</script\s*>', '', 'gi');
  v_text := regexp_replace(v_text, '<style\M.*?</style\s*>', '', 'gi');
  v_text := regexp_replace(v_text, '<!--.*?-->', '', 'g');
  -- Block ends and line breaks separate words; inline markup doesn't (<b>W</b>ord).
  v_text := regexp_replace(v_text, '<br\M[^>]*>', ' ', 'gi');
  v_text := regexp_replace(v_text, '</(p|li|h[1-6]|blockquote|figcaption|div)\s*>', ' ', 'gi');
  loop
    v_before := v_text;
    v_text := regexp_replace(v_text, '<[^<>]*>', '', 'g');
    exit when v_text = v_before;
  end loop;
  v_text := translate(v_text, '<>', '');

  -- Entities last (decoding first could make tags). Numeric ones only for real
  -- characters, so nothing here can raise and block saving a text.
  for v_entity in
    select distinct m[1] from regexp_matches(v_text, '&#([0-9]{1,7}|[xX][0-9a-fA-F]{1,6});', 'g') as m
  loop
    v_code := case when v_entity ~ '^[xX]'
                   then ('x' || lpad(substr(v_entity, 2), 8, '0'))::bit(32)::integer
                   else v_entity::integer end;
    if v_code between 1 and 1114111 and v_code not between 55296 and 57343 then
      v_text := replace(v_text, '&#' || v_entity || ';', chr(v_code));
    end if;
  end loop;
  v_text := regexp_replace(v_text, '&nbsp;', ' ', 'gi');
  v_text := regexp_replace(v_text, '&lt;', '<', 'gi');
  v_text := regexp_replace(v_text, '&gt;', '>', 'gi');
  v_text := regexp_replace(v_text, '&quot;', '"', 'gi');
  v_text := regexp_replace(v_text, '&apos;', '''', 'gi');
  v_text := regexp_replace(v_text, '&rsquo;', '’', 'gi');
  v_text := regexp_replace(v_text, '&lsquo;', '‘', 'gi');
  v_text := regexp_replace(v_text, '&rdquo;', '”', 'gi');
  v_text := regexp_replace(v_text, '&ldquo;', '“', 'gi');
  v_text := regexp_replace(v_text, '&amp;', '&', 'gi');

  return btrim(regexp_replace(v_text, '[\s ]+', ' ', 'g'));
end
$$;

-- Query → folded words of at least 2 characters, the first 8 distinct ones in
-- the order typed (the app's queryWords() follows the same rules).
create or replace function public.search_words(p_text text)
returns text[]
language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(w.word order by w.first_at), '{}')
  from (
    select s.word, min(s.at) as first_at
    from regexp_split_to_table(fold_text(left(coalesce(p_text, ''), 200)), '[^[:alnum:]]+')
           with ordinality as s(word, at)
    where length(s.word) >= 2
    group by s.word
    order by min(s.at)
    limit 8
  ) w
$$;

-- Words → `'word':* & 'word':*` (every word, as a prefix); null without words.
-- Each word is quoted, so nothing typed can become tsquery syntax.
create or replace function public.prefix_tsquery(p_words text[])
returns tsquery
language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select case when coalesce(cardinality(p_words), 0) = 0 then null
              else to_tsquery('simple', (select string_agg(quote_literal(w) || ':*', ' & ')
                                         from unnest(p_words) as w)) end
$$;

-- A searchable part: its heading (weight A) and its plain text (weight D).
create or replace function public.topic_search_vector(p_heading text, p_text text)
returns tsvector
language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select setweight(to_tsvector('simple', fold_text(p_heading)), 'A')
      || setweight(to_tsvector('simple', fold_text(p_text)), 'D')
$$;

-- A topic's introduction: the title over the summary and the body.
create or replace function public.topic_intro_search(p_title text, p_summary text, p_body_html text)
returns tsvector
language sql immutable parallel safe cost 1000
set search_path = public, pg_temp
as $$
  select topic_search_vector(p_title, concat_ws(' ', nullif(p_summary, ''), nullif(html_plain_text(p_body_html), '')))
$$;

-- Per word: how often a word starting with it occurs in the text, +5 when one
-- is in the heading (the score the JavaScript search used).
create or replace function public.topic_hit_score(p_vector tsvector, p_words text[])
returns real
language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select (coalesce(sum(s.text_hits), 0) + 5 * count(distinct s.word) filter (where s.in_heading))::real
  from (
    select w.word,
           (select count(*) from unnest(l.weights) as x(weight) where x.weight <> 'A') as text_hits,
           'A' = any(l.weights) as in_heading
    from unnest(p_words) as w(word)
    join unnest(p_vector) as l on starts_with(l.lexeme, w.word)
  ) s
$$;

-- About 260 characters of plain text around the first word that starts with
-- one of the words, cut at spaces; "… " / " …" where the text goes on.
create or replace function public.search_snippet(p_text text, p_words text[])
returns text
language plpgsql immutable parallel safe
set search_path = public, pg_temp
as $$
declare
  v_text text := coalesce(p_text, '');
  v_len integer := length(coalesce(p_text, ''));
  v_first integer := 0;
  v_start integer;
  v_end integer;  -- exclusive
  v_at integer;
begin
  if coalesce(cardinality(p_words), 0) > 0 then
    -- fold_text() keeps every character in place, so positions line up.
    v_first := regexp_instr(fold_text(v_text), '\m(' ||
      (select string_agg(regexp_replace(w, '([^[:alnum:]])', '\\\1', 'g'), '|') from unnest(p_words) as w)
      || ')');
  end if;
  if v_first = 0 then
    v_first := 1;
  end if;

  v_start := greatest(1, v_first - 80);
  if v_start > 1 then
    v_at := strpos(substr(v_text, v_start), ' ');
    if v_at > 0 and v_start + v_at - 1 < v_first then
      v_start := v_start + v_at;
    end if;
  end if;
  v_end := least(v_len + 1, v_start + 260);
  if v_end <= v_len then
    v_at := strpos(reverse(substr(v_text, 1, v_end)), ' ');
    if v_at > 0 and v_end - v_at + 1 > v_first then
      v_end := v_end - v_at + 1;
    end if;
  end if;

  return case when v_start > 1 then '… ' else '' end
      || substr(v_text, v_start, v_end - v_start)
      || case when v_end <= v_len then ' …' else '' end;
end
$$;

revoke execute on function
  public.fold_text(text), public.html_plain_text(text), public.search_words(text),
  public.prefix_tsquery(text[]), public.topic_search_vector(text, text),
  public.topic_intro_search(text, text, text), public.topic_hit_score(tsvector, text[]),
  public.search_snippet(text, text[])
  from public;
-- Pure functions of their arguments. The public RPCs below run as the caller,
-- and writers of entry_chapters evaluate its generated column.
grant execute on function
  public.fold_text(text), public.html_plain_text(text), public.search_words(text),
  public.prefix_tsquery(text[]), public.topic_search_vector(text, text),
  public.topic_intro_search(text, text, text), public.topic_hit_score(tsvector, text[]),
  public.search_snippet(text, text[])
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Search vectors and indexes
-- ---------------------------------------------------------------------------

alter table public.entry_chapters add column search tsvector
  generated always as (topic_search_vector(title, html_plain_text(body_html))) stored;
create index entry_chapters_search on public.entry_chapters using gin (search);

-- Derived from public columns (body_html, title); anon reads columns by name
-- (20261008000110), `authenticated` keeps its table-wide grant.
grant select (search) on public.entry_chapters to anon;

create index entries_topic_intro_search on public.entries
  using gin (topic_intro_search(title, summary, body_html))
  where kind = 'entry' and status = 'published' and translation_of is null;

-- ---------------------------------------------------------------------------
-- 3. search_topics()
-- ---------------------------------------------------------------------------

create or replace function public.search_topics(p_text text, p_limit integer default 30)
returns table (slug text, topic_title text, heading text, anchor text, rank real, snippet text)
language sql stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select w.words, prefix_tsquery(w.words) as query
    from (select search_words(p_text) as words) w
  ),
  hits as (
    -- Introductions (index entries_topic_intro_search).
    (select e.id as entry_id, null::uuid as chapter_id, e.slug, e.title as topic_title,
            e.title as heading, null::text as anchor, -1 as position,
            topic_hit_score(topic_intro_search(e.title, e.summary, e.body_html), q.words) as score
     from entries e, q
     where q.query is not null
       and e.kind = 'entry' and e.status = 'published' and e.translation_of is null
       and topic_intro_search(e.title, e.summary, e.body_html) @@ q.query
     union all
     -- Chapters (index entry_chapters_search); the anchor counts chapters in
     -- page order, as the topic page does (`topic-1` is the first).
     select c.entry_id, c.id, e.slug, e.title, c.title,
            'topic-' || (select count(*) from entry_chapters o
                          where o.entry_id = c.entry_id and o.position <= c.position),
            c.position,
            topic_hit_score(c.search, q.words)
     from entry_chapters c join entries e on e.id = c.entry_id, q
     where q.query is not null and c.search @@ q.query
       and e.kind = 'entry' and e.status = 'published' and e.translation_of is null)
    order by score desc, topic_title, slug, position
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  )
  select h.slug, h.topic_title, h.heading, h.anchor, h.score,
         search_snippet(
           case when h.chapter_id is null
                then (select concat_ws(' ', nullif(e.summary, ''), nullif(html_plain_text(e.body_html), ''))
                        from entries e where e.id = h.entry_id)
                else (select html_plain_text(c.body_html) from entry_chapters c where c.id = h.chapter_id)
           end,
           q.words)
  from hits h, q
  order by h.score desc, h.topic_title, h.slug, h.position;
$$;

-- Reads published topics only (filter above + RLS as the caller).
revoke execute on function public.search_topics(text, integer) from public;
grant execute on function public.search_topics(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. search(): topics found by their chapters too
-- ---------------------------------------------------------------------------
--
-- Same as 20261012000010 plus `chapter_hits`. A row found before (own text or
-- tagged country) keeps exactly its rank; one found only through a chapter
-- ranks at half the chapter's ts_rank (a chapter title weighs as much as an
-- entry title, so these stay below direct hits of the same strength).

create or replace function public.search(p_text text, p_limit integer default 12)
returns table (id text, kind text, title text, subtitle text, url text, rank real)
language sql stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (select search_query(p_text) as query),
  -- Chapters are indexed folded, so they are asked with the folded words.
  cq as (select prefix_tsquery(search_words(p_text)) as query),
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
  -- Entries with a matching chapter (GIN index entry_chapters_search).
  chapter_hits as (
    select c.entry_id, max(ts_rank(c.search, cq.query)) as rank
    from entry_chapters c, cq
    where cq.query is not null and c.search @@ cq.query
    group by c.entry_id
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
           case when e.id in (select th.id from text_hits th
                              union
                              select ch.entry_id from country_hits ch)
                then greatest(
                       ts_rank(e.search, q.query),
                       case when e.id in (select ch.entry_id from country_hits ch) then 0.5 else 0 end
                     )::real
                else (select (0.5 * h.rank)::real from chapter_hits h where h.entry_id = e.id)
           end
    from entries e, q
    where q.query is not null and e.status = 'published' and e.translation_of is null
      and e.id in (select th.id from text_hits th
                   union
                   select ch.entry_id from country_hits ch
                   union
                   select h.entry_id from chapter_hits h)
  )
  select * from hits
  order by 6 desc, 3
  limit least(greatest(coalesce(p_limit, 12), 1), 40);
$$;

-- create or replace keeps the existing grants (anon, authenticated); restated
-- so this file reads complete on its own.
revoke execute on function public.search(text, integer) from public;
grant execute on function public.search(text, integer) to anon, authenticated;
