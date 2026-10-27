-- =============================================================================
-- Real visitors' Core Web Vitals, counted without cookies (owner request 2026-10-27)
-- =============================================================================
-- Why: field data from CrUX needs 28 days and enough traffic per URL; this
-- shows the effect of a performance fix within days. ADR-033.
--
-- Same privacy model as the conversion counter (20261016000010, ADR-029):
-- no IP address, user agent, account id, full URL or referrer is stored. The
-- browser sends a metric name, a rounded value (ms, CLS × 1000), the first
-- path segment, mobile/desktop and the navigation type; the database keeps
-- only a daily histogram per (day, metric, page group, device, navigation
-- type). A single page view can't be picked out of it.
--
-- Histogram: one fixed bucket scale for every metric (web_vital_bounds()):
-- bucket lower bounds 0, 1, 2, … 40, then each next bound = bound + bound/20
-- (integer division), up to 60000 — 195 buckets. Below 40 every value has
-- its own bucket; above, a bucket is at most 5 % of its lower bound wide.
-- web_vitals_p75() finds the bucket holding the 75th percentile and
-- interpolates linearly inside it, so its answer is off by less than 5 %
-- (usually ~1 %) from the exact p75 of the raw values.
--
-- Writes: only record_web_vitals(), and only the server may call it (the
-- /api/v route handler, after its per-IP limit in the shared rate_limits
-- store). Reads: web_vitals_p75() and the table, for the `members` section
-- ("v"), like the conversion counts. Kept 400 days (db_housekeeping()).
--
-- Phase: expand (new table and functions; db_housekeeping() gains one delete;
-- the running app ignores all of it).
-- Default privileges are revoked (20261013000210): every grant is explicit.
-- Tests: supabase/tests/web-vitals.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Bucket scale. Immutable and the same for every metric (ms metrics use up to
-- 60000, CLS × 1000 up to 10000).
-- ---------------------------------------------------------------------------
create or replace function public.web_vital_bounds()
returns integer[]
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  v_bounds integer[] := array[0];
  v_last integer := 0;
begin
  loop
    v_last := v_last + greatest(1, v_last / 20);
    exit when v_last > 60000;
    v_bounds := v_bounds || v_last;
  end loop;
  return v_bounds;
end;
$$;

comment on function public.web_vital_bounds() is
  'Lower bounds of the web vitals histogram buckets (0..60000, at most 5 % wide).';

create table public.web_vitals_daily (
  day        date not null default current_date,
  metric     text not null check (metric in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  -- First path segment of the page ('/', '/topics', '/country' …, '/other').
  path_group text not null check (path_group ~ '^/[a-z-]{0,32}$'),
  device     text not null check (device in ('mobile', 'desktop')),
  nav_type   text not null check (nav_type in ('navigate', 'reload', 'back-forward', 'soft')),
  -- Page views per bucket of web_vital_bounds() (counts[i] = values in
  -- [bounds[i], bounds[i + 1]) ).
  counts     integer[] not null check (
               array_ndims(counts) = 1 and cardinality(counts) between 1 and 400
               and array_position(counts, null) is null and 0 <= all (counts)),
  -- Set by record_web_vitals() on every hit (the only writer; no stamp_row needed).
  updated_at timestamptz not null default now(),
  primary key (day, metric, path_group, device, nav_type)
);

comment on table public.web_vitals_daily is
  'Daily histograms of real visitors'' Core Web Vitals. No IP, user agent, user id or URL is stored.';

-- ---------------------------------------------------------------------------
-- One beacon: 1–10 metrics of one device. Anything unknown or out of range is
-- refused as a whole, not stored under some fallback (the route handler
-- validates the same first).
--   p_metrics: [{ "n": "LCP", "v": 2400, "p": "/topics", "t": "navigate" }, …]
-- ---------------------------------------------------------------------------
create or replace function public.record_web_vitals(p_device text, p_metrics jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bounds integer[] := public.web_vital_bounds();
  v_item   jsonb;
  v_metric text;
  v_value  integer;
  v_path   text;
  v_nav    text;
  v_bucket integer;
  v_counts integer[];
begin
  if p_device is null or p_device not in ('mobile', 'desktop') then
    raise exception 'invalid_device' using errcode = '22023';
  end if;
  if p_metrics is null or jsonb_typeof(p_metrics) <> 'array'
     or jsonb_array_length(p_metrics) not between 1 and 10 then
    raise exception 'invalid_metrics' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_metrics) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_metrics' using errcode = '22023';
    end if;
    v_metric := v_item ->> 'n';
    if v_metric is null or v_metric not in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB') then
      raise exception 'invalid_metric' using errcode = '22023';
    end if;
    -- A whole number: ms 0–60000, CLS × 1000 0–10000.
    if jsonb_typeof(v_item -> 'v') is distinct from 'number'
       or (v_item ->> 'v') !~ '^[0-9]{1,5}$' then
      raise exception 'invalid_value' using errcode = '22023';
    end if;
    v_value := (v_item ->> 'v')::integer;
    if v_value > (case when v_metric = 'CLS' then 10000 else 60000 end) then
      raise exception 'invalid_value' using errcode = '22023';
    end if;
    v_path := v_item ->> 'p';
    if v_path is null or char_length(v_path) > 64 or left(v_path, 1) <> '/' then
      raise exception 'invalid_path' using errcode = '22023';
    end if;
    v_nav := v_item ->> 't';
    if v_nav is null or v_nav not in ('navigate', 'reload', 'back-forward', 'soft') then
      raise exception 'invalid_nav' using errcode = '22023';
    end if;

    v_bucket := (select count(*) from unnest(v_bounds) as b(lower_bound)
                 where b.lower_bound <= v_value);
    v_counts := array_fill(0, array[cardinality(v_bounds)]);
    v_counts[v_bucket] := 1;

    insert into web_vitals_daily as w (day, metric, path_group, device, nav_type, counts)
    values (current_date, v_metric, conversion_path_group(v_path), p_device, v_nav, v_counts)
    on conflict on constraint web_vitals_daily_pkey do update
      set counts[v_bucket] = least(w.counts[v_bucket] + 1, 2147483647),
          updated_at = now();
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 75th percentile per metric and device over the last `p_days` days (today
-- included), or per day with `p_by_day`. Values in ms, CLS × 1000. Rows only
-- where there are samples.
-- ---------------------------------------------------------------------------
create or replace function public.web_vitals_p75(p_days integer, p_by_day boolean default false)
returns table (day date, metric text, device text, samples bigint, p75 integer)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_bounds integer[] := public.web_vital_bounds();
begin
  if not public.has_perm('members', 'v') then
    raise exception 'You don''t have permission to see these numbers.' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 400 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;

  return query
  with buckets as (
    select case when p_by_day then w.day end as d, w.metric as m, w.device as dev,
           b.i::integer as i, sum(b.c)::bigint as c
    from web_vitals_daily w
    cross join lateral unnest(w.counts) with ordinality as b(c, i)
    where w.day > current_date - p_days and w.day <= current_date and b.c > 0
    group by 1, 2, 3, 4
  ), running as (
    select bk.d, bk.m, bk.dev, bk.i, bk.c,
           sum(bk.c) over (partition by bk.d, bk.m, bk.dev order by bk.i) as upto,
           sum(bk.c) over (partition by bk.d, bk.m, bk.dev) as total
    from buckets bk
  )
  -- The bucket holding the value of rank ceil(0.75 × total) (nearest rank);
  -- its c values are taken as evenly spread over [lower, upper), each in the
  -- middle of its share, so a bucket one unit wide gives its exact value.
  select distinct on (r.d, r.m, r.dev)
         r.d, r.m, r.dev, r.total::bigint,
         floor(v_bounds[r.i]
               + (coalesce(v_bounds[r.i + 1], 60001) - v_bounds[r.i])
                 * (ceil(0.75 * r.total) - (r.upto - r.c) - 0.5) / r.c)::integer
  from running r
  where r.upto >= ceil(0.75 * r.total)
  order by r.d, r.m, r.dev, r.i;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access: no one writes directly; the server calls record_web_vitals();
-- members "v" (and the admin) read the histograms and the percentiles.
-- ---------------------------------------------------------------------------
alter table public.web_vitals_daily enable row level security;

create policy web_vitals_read on public.web_vitals_daily
  for select to authenticated using ((select public.has_perm('members', 'v')));

revoke all on public.web_vitals_daily from public, anon, authenticated;
grant select on public.web_vitals_daily to authenticated;

revoke execute on function public.web_vital_bounds() from public, anon, authenticated;
revoke execute on function public.record_web_vitals(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_web_vitals(text, jsonb) to service_role;
revoke execute on function public.web_vitals_p75(integer, boolean) from public, anon;
grant execute on function public.web_vitals_p75(integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Retention: the daily housekeeping (20261008000090) also drops histograms
-- older than 400 days — enough for a year-on-year look, and the table can't
-- grow without end.
-- ---------------------------------------------------------------------------
create or replace function public.db_housekeeping()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  audit integer;
  previews integer;
  limits integer;
  revisions integer;
  vitals integer;
  runs integer := 0;
begin
  audit := public.purge_audit_log();
  delete from preview_links where expires_at < now() - interval '7 days';
  get diagnostics previews = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics limits = row_count;
  revisions := public.prune_entry_revisions();
  delete from web_vitals_daily where day < current_date - 400;
  get diagnostics vitals = row_count;
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''14 days''';
    get diagnostics runs = row_count;
  end if;
  return jsonb_build_object('audit_log', audit, 'preview_links', previews,
                            'rate_limits', limits, 'entry_revisions', revisions,
                            'web_vitals', vitals, 'cron_runs', runs);
end;
$$;
revoke execute on function public.db_housekeeping() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privacy policy: say so, next to the conversion counter's sentence. Applied
-- only while that sentence is in the page and the new one isn't, so a page
-- the editors have rewritten is left alone; the revision trigger keeps the
-- previous text.
-- ---------------------------------------------------------------------------
update public.site_pages
set body_html = replace(
      body_html,
      'they are rate-limited by a one-way hash of your IP address.</li>',
      'they are rate-limited by a one-way hash of your IP address.</li>'
        || E'\n<li>In the same way we measure how quickly pages load and respond on visitors’ devices (Core Web Vitals such as loading time, responsiveness and layout shifts). Only rounded timings are kept, as anonymous daily totals per section of the site and type of device (phone or computer); no cookie is set and nothing about you is stored with them.</li>'
    )
where slug = 'privacy'
  and body_html like '%they are rate-limited by a one-way hash of your IP address.</li>%'
  and body_html not like '%we measure how quickly pages load%';
