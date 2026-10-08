-- Daily housekeeping (review 2026-10-07, D-M3): rows that only ever grow.
--
--   * audit_log older than 12 months — purge_audit_log() has existed since
--     20260930000001 but nothing ever called it;
--   * preview links a week past their expiry (they can't be opened anyway);
--   * rate-limit windows older than a day (hit_rate_limit() only needs the
--     current window);
--   * pg_cron's own run history older than 14 days — the 5-minute publishing
--     job alone adds ~105 000 rows a year.
--
-- Runs inside the database via pg_cron like publish_due_entries(), so no
-- secret leaves it. PGlite (DB tests) has no pg_cron: the schedule is skipped
-- there and the tests call the function directly.

create function public.db_housekeeping()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  audit integer;
  previews integer;
  limits integer;
  runs integer := 0;
begin
  audit := public.purge_audit_log();
  delete from preview_links where expires_at < now() - interval '7 days';
  get diagnostics previews = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics limits = row_count;
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''14 days''';
    get diagnostics runs = row_count;
  end if;
  return jsonb_build_object('audit_log', audit, 'preview_links', previews,
                            'rate_limits', limits, 'cron_runs', runs);
end;
$$;
revoke execute on function public.db_housekeeping() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- Same name = the job is replaced, so a rerun doesn't duplicate it.
    execute $sql$select cron.schedule('atlas-housekeeping', '23 3 * * *',
      'select public.db_housekeeping()')$sql$;
  else
    raise notice 'pg_cron not available (PGlite) — housekeeping is not scheduled.';
  end if;
end;
$$;
