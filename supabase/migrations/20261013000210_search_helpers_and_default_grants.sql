-- =============================================================================
-- Search helpers and default grants (hardening)
-- =============================================================================
--
-- 1. html_plain_text() strips tags in linear time and reads at most 400,000
--    characters (the longest body_html the tables accept), with the same
--    result as before for every text up to that length. Numeric entities are
--    decoded in one pass too. entry_chapters.search and the index
--    entries_topic_intro_search are rebuilt from the new definition.
-- 2. search() and search_topics() run as definer. Both already filter on
--    `status = 'published'`, originals only (`translation_of is null`), and
--    search_topics() on topics (`kind = 'entry'`); they read only columns
--    anon may read. Results are the same as before for anon.
-- 3. The search helpers are no longer callable as RPC: execute is revoked from
--    public and anon. authenticated keeps only the four that writers of
--    entries / entry_chapters evaluate in the generated column and the index
--    expression (fold_text, html_plain_text, topic_search_vector,
--    topic_intro_search) — Postgres checks EXECUTE as the writing role there.
-- 4. Functions the app calls with the service key get an explicit grant
--    instead of relying on Supabase's default privileges.
-- 5. Tables: TRUNCATE, REFERENCES, TRIGGER and MAINTAIN revoked from anon and
--    authenticated (the app needs none of them); anon writes nothing directly
--    (no policy lets it), so INSERT / UPDATE / DELETE are revoked from anon.
-- 6. Default privileges: tables, sequences and functions created later by the
--    migration role are no longer granted to anon / authenticated, and
--    functions no longer to PUBLIC. Every new object needs explicit grants
--    (as the DB standard already asks); service_role keeps its defaults.
--
-- Tests: supabase/tests/search-helpers-hardening.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. html_plain_text(): linear, bounded
-- ---------------------------------------------------------------------------

create or replace function public.html_plain_text(p_html text)
returns text
language plpgsql immutable parallel safe cost 1000
set search_path = public, pg_temp
as $$
declare
  -- The longest body the tables allow (entries.body_html); nothing stored is cut.
  v_text text := left(coalesce(p_html, ''), 400000);
  v_last_gt integer;
begin
  -- Scripts, styles and comments aren't text.
  v_text := regexp_replace(v_text, '<script\M.*?</script\s*>', '', 'gi');
  v_text := regexp_replace(v_text, '<style\M.*?</style\s*>', '', 'gi');
  v_text := regexp_replace(v_text, '<!--.*?-->', '', 'g');
  -- Block ends and line breaks separate words; inline markup doesn't (<b>W</b>ord).
  v_text := regexp_replace(v_text, '<br\M[^>]*>', ' ', 'gi');
  v_text := regexp_replace(v_text, '</(p|li|h[1-6]|blockquote|figcaption|div)\s*>', ' ', 'gi');

  -- Tags: every <…> goes, innermost first, until none is left (<scr<b>ipt>
  -- goes whole), as before. Plain tags go in one pass. Only if a '<' still
  -- comes before a '>' after that, one more pass over the pieces: a '>' closes
  -- the latest open '<' (a '>' with none open closes nothing), and a piece of
  -- text stays only when no '<' open around it is closed later — i.e. the
  -- number of open '<' (`depth`) never drops below the piece's own depth
  -- afterwards. Unpaired '<' and '>' are dropped.
  v_text := regexp_replace(v_text, '<[^<>]*>', '', 'g');
  v_last_gt := length(v_text) + 1 - strpos(reverse(v_text), '>');
  if v_last_gt <= length(v_text) and strpos(v_text, '<') between 1 and v_last_gt - 1 then
    select coalesce(string_agg(t.piece, '' order by t.n), '') into v_text
    from (
      select d.piece, d.n, d.depth,
             min(d.depth) over (order by d.n desc rows between unbounded preceding and current row) as depth_after
      from (
        select s.piece, s.n,
               -- A running count that can't go below zero: the sum minus its lowest point so far.
               s.level - least(0, min(s.level) over (order by s.n rows between unbounded preceding and current row)) as depth
        from (
          select p.m[1] as piece, p.n,
                 sum(case p.m[1] when '<' then 1 when '>' then -1 else 0 end)
                   over (order by p.n rows between unbounded preceding and current row) as level
          from regexp_matches(v_text, '[<>]|[^<>]+', 'g') with ordinality as p(m, n)
        ) s
      ) d
    ) t
    where t.piece not in ('<', '>') and t.depth = t.depth_after;
  end if;
  v_text := translate(v_text, '<>', '');

  -- Entities last (decoding first could make tags), each decoded once. Numeric
  -- ones only for real characters, so nothing here can raise and block saving.
  if strpos(v_text, '&#') > 0 then
    select coalesce(string_agg(coalesce(
             (select chr(c.code)
              from (select case when e.m[2] ~ '^[xX]'
                                then ('x' || lpad(substr(e.m[2], 2), 8, '0'))::bit(32)::integer
                                else e.m[2]::integer end as code) c
              where c.code between 1 and 1114111 and c.code not between 55296 and 57343),
             e.m[1]), '' order by e.n), '') into v_text
    from regexp_matches(v_text, '(&#([0-9]{1,7}|[xX][0-9a-fA-F]{1,6});|&|[^&]+)', 'g') with ordinality as e(m, n);
  end if;
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

  return btrim(regexp_replace(v_text, '[\s ]+', ' ', 'g'));
end
$$;

-- Values stored from an immutable function are recomputed when it changes:
-- SET EXPRESSION rewrites entry_chapters (and its indexes) with the same
-- expression; the expression index on entries is rebuilt.
alter table public.entry_chapters
  alter column search set expression as (topic_search_vector(title, html_plain_text(body_html)));
reindex index public.entries_topic_intro_search;

-- ---------------------------------------------------------------------------
-- 2. search() and search_topics() as definer
-- ---------------------------------------------------------------------------

alter function public.search(text, integer) security definer;
alter function public.search_topics(text, integer) security definer;

comment on function public.search(text, integer) is
  'Site search. Security definer: reads published originals only (filtered in the function), so the helpers it uses need no grant to the caller.';
comment on function public.search_topics(text, integer) is
  'Search inside published original topics. Security definer: filters status, kind and translation_of itself.';

revoke execute on function public.search(text, integer), public.search_topics(text, integer) from public;
grant execute on function public.search(text, integer), public.search_topics(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Search helpers: no direct calls
-- ---------------------------------------------------------------------------

revoke execute on function
  public.fold_text(text), public.html_plain_text(text), public.search_words(text),
  public.prefix_tsquery(text[]), public.topic_search_vector(text, text),
  public.topic_intro_search(text, text, text), public.topic_hit_score(tsvector, text[]),
  public.search_snippet(text, text[]), public.search_query(text)
  from public, anon, authenticated;
-- Evaluated as the writing role in entry_chapters.search and the index
-- entries_topic_intro_search (editors write through RLS).
grant execute on function
  public.fold_text(text), public.html_plain_text(text), public.topic_search_vector(text, text),
  public.topic_intro_search(text, text, text)
  to authenticated;
-- Imports with the service key write entries and chapters too.
grant execute on function
  public.fold_text(text), public.html_plain_text(text), public.search_words(text),
  public.prefix_tsquery(text[]), public.topic_search_vector(text, text),
  public.topic_intro_search(text, text, text), public.topic_hit_score(tsvector, text[]),
  public.search_snippet(text, text[]), public.search_query(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. RPCs called with the service key: explicit grants
-- ---------------------------------------------------------------------------

grant execute on function
  public.hit_rate_limit(text, integer, integer),
  public.replace_portrait_items(text, text, text, jsonb),
  public.submit_volunteer_application(text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Table privileges nobody uses
-- ---------------------------------------------------------------------------

revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- 6. Default privileges for objects created from now on
-- ---------------------------------------------------------------------------

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
-- PUBLIC's EXECUTE on new functions is a global default, so it is revoked
-- globally (for objects the migration role creates).
alter default privileges revoke execute on functions from public;
