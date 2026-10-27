-- =============================================================================
-- Page groups of the cookie-less counters: /entries and the newer pages
-- =============================================================================
-- Why: the topic pages moved from /topics to /entries (308), and /careers and
-- /skills were added. conversion_path_group() didn't know them, so visits and
-- Core Web Vitals of every entry page were counted as '/other'
-- (conversion_events_daily, web_vitals_daily, ADR-029 / ADR-033).
--
-- Same function, a longer allowlist; '/topics' stays for the rows already
-- counted under it and for anyone still arriving through the old address.
-- Phase: expand (same signature and result type; rows already stored are kept).
-- Grants: create or replace keeps the existing (revoked) privileges.
-- Tests: supabase/tests/page-groups.test.mjs.
-- =============================================================================

create or replace function public.conversion_path_group(p_path text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_path ~ '^/([?#]|$)' then '/'
    when segment in ('entries', 'topics', 'country', 'region', 'global-issue',
                     'global-issues', 'countries', 'news', 'authors', 'view',
                     'membership', 'about', 'search', 'newsletter', 'careers',
                     'skills', 'privacy', 'terms', 'accessibility') then '/' || segment
    else '/other'
  end
  from (select lower(coalesce(substring(p_path from '^/([^/?#]*)'), '')) as segment) s;
$$;
