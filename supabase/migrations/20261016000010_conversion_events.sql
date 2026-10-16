-- =============================================================================
-- Cookie-less conversion counter (no cookies, no consent banner, no personal data)
-- =============================================================================
--
-- A handful of moments worth counting (a click on "Donate & Join", the demo
-- thank-you page, a sent volunteer application, a newsletter sign-up, a share,
-- "Write a topic", a visit referred by an AI assistant) as one number per day,
-- event, page group and referrer group. Nothing identifies a visitor: no IP
-- address, user agent, account id, full URL or referrer is ever stored — the
-- page is reduced to its first path segment and the referrer to the name of an
-- AI assistant (or 'none') before anything is written.
--
-- Writes: only record_event(), and only the server may call it (the /api/e
-- route handler, after its per-IP limit in the shared rate_limits store). A
-- direct call with the public key is refused, so nobody can inflate the counts
-- around that limit. Reads: the admin overview, for the `members` section
-- ("v") — the people who look after patrons and supporters.
-- =============================================================================

create table public.conversion_events_daily (
  day            date not null default current_date,
  event          text not null check (event in (
                   'donate_click', 'checkout_complete', 'volunteer_submit',
                   'newsletter_signup', 'share_click', 'topic_write_click', 'ai_referral')),
  -- First path segment of the page ('/', '/topics', '/membership' …, '/other').
  path_group     text not null check (path_group ~ '^/[a-z-]{0,32}$'),
  -- AI assistant that referred the visit, or 'none'.
  referrer_group text not null check (referrer_group in (
                   'none', 'chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing-chat')),
  count          integer not null default 0 check (count >= 0),
  -- Set by record_event() on every hit (the only writer; no stamp_row needed).
  updated_at     timestamptz not null default now(),
  primary key (day, event, path_group, referrer_group)
);

comment on table public.conversion_events_daily is
  'Daily aggregated conversion counts. No IP, user agent, user id, URL or referrer is stored.';

-- The admin reads the last 30 days of every event.
create index conversion_events_daily_event_day on public.conversion_events_daily (event, day);

-- ---------------------------------------------------------------------------
-- Page group: the first path segment when it is one of the public sections,
-- otherwise '/other' — a typed-in path can never become a new group.
-- ---------------------------------------------------------------------------
create or replace function public.conversion_path_group(p_path text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_path ~ '^/([?#]|$)' then '/'
    when segment in ('topics', 'country', 'region', 'global-issue', 'global-issues',
                     'countries', 'news', 'authors', 'view', 'membership', 'about',
                     'search', 'newsletter') then '/' || segment
    else '/other'
  end
  from (select lower(coalesce(substring(p_path from '^/([^/?#]*)'), '')) as segment) s;
$$;

-- ---------------------------------------------------------------------------
-- One hit. Unknown events, referrer groups or malformed paths are refused, not
-- stored under some fallback (the route handler validates the same first).
-- ---------------------------------------------------------------------------
create or replace function public.record_event(event text, path text, ref text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := coalesce(nullif(ref, ''), 'none');
begin
  if event is null or char_length(event) > 32 or event not in (
       'donate_click', 'checkout_complete', 'volunteer_submit',
       'newsletter_signup', 'share_click', 'topic_write_click', 'ai_referral') then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  if path is null or char_length(path) > 512 or left(path, 1) <> '/' then
    raise exception 'invalid_path' using errcode = '22023';
  end if;
  if char_length(v_ref) > 32 or v_ref not in (
       'none', 'chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing-chat') then
    raise exception 'invalid_ref' using errcode = '22023';
  end if;
  -- An AI referral without an AI referrer means nothing.
  if event = 'ai_referral' and v_ref = 'none' then
    raise exception 'invalid_ref' using errcode = '22023';
  end if;

  insert into conversion_events_daily as c (day, event, path_group, referrer_group, count)
  values (current_date, event, conversion_path_group(path), v_ref, 1)
  -- By constraint name: the parameter `event` would shadow the column in a column list.
  on conflict on constraint conversion_events_daily_pkey do update
    set count = least(c.count + 1, 2147483647),
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Access: no one writes directly; the server calls record_event(); readers of
-- the members section see the counts.
-- ---------------------------------------------------------------------------
alter table public.conversion_events_daily enable row level security;

create policy conversion_events_read on public.conversion_events_daily
  for select to authenticated using ((select public.has_perm('members', 'v')));

revoke all on public.conversion_events_daily from public, anon, authenticated;
grant select on public.conversion_events_daily to authenticated;

revoke execute on function public.conversion_path_group(text) from public, anon, authenticated;
revoke execute on function public.record_event(text, text, text) from public, anon, authenticated;
grant execute on function public.record_event(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Privacy policy: say so. Applied only while the anchor sentence is still in
-- the page and the new one isn't (as in 20261015000010), so a page the editors
-- have rewritten is left alone; the revision trigger keeps the previous text.
-- ---------------------------------------------------------------------------
update public.site_pages
set body_html = replace(
      body_html,
      'only anonymous totals such as page views and countries.</li>',
      'only anonymous totals such as page views and countries.</li>'
        || E'\n<li>We also count a few actions — a click on “Donate &amp; Join”, a newsletter sign-up, a share, a visit that arrives from an AI assistant — as anonymous daily totals per section of the site. No cookie is set and nothing about you is stored with them; like searches, they are rate-limited by a one-way hash of your IP address.</li>'
    )
where slug = 'privacy'
  and body_html like '%only anonymous totals such as page views and countries.</li>%'
  and body_html not like '%We also count a few actions%';
