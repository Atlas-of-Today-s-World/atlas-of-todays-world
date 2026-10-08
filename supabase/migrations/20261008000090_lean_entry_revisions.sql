-- Lean entry revisions with retention (review 2026-10-07, D-M2).
--
--   * keep_entry_revision() stored to_jsonb(old) including the generated
--     `search` tsvector, which roughly doubled every snapshot. Nothing reads it
--     back (restoreRevision copies title, summary, body_html and cover_url), so
--     it is left out — and stripped from the snapshots already stored.
--   * revisions only ever grew: prune_entry_revisions() keeps the newest 50 per
--     entry plus the newest published one (the approval detail compares against
--     it), and the daily db_housekeeping() now calls it.

create or replace function public.keep_entry_revision()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if (old.title, old.summary, old.body_html, old.cover_url)
     is distinct from (new.title, new.summary, new.body_html, new.cover_url) then
    insert into entry_revisions (entry_id, saved_by, snapshot)
    values (old.id, auth.uid(), to_jsonb(old) - 'search');
  end if;
  return null;
end;
$$;
revoke execute on function public.keep_entry_revision() from public, anon, authenticated;

update public.entry_revisions set snapshot = snapshot - 'search' where snapshot ? 'search';

create function public.prune_entry_revisions()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  delete from entry_revisions r
  using (
    select id,
           row_number() over (partition by entry_id
                              order by saved_at desc, id desc) as newest,
           published,
           row_number() over (partition by entry_id, published
                              order by saved_at desc, id desc) as newest_of_kind
    from (
      select id, entry_id, saved_at,
             coalesce(snapshot ->> 'status' = 'published', false) as published
      from entry_revisions
    ) s
  ) ranked
  where r.id = ranked.id
    and ranked.newest > 50
    and not (ranked.published and ranked.newest_of_kind = 1);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke execute on function public.prune_entry_revisions() from public, anon, authenticated;

-- Body as in 20261008000060, plus the revision retention.
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
  runs integer := 0;
begin
  audit := public.purge_audit_log();
  delete from preview_links where expires_at < now() - interval '7 days';
  get diagnostics previews = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  get diagnostics limits = row_count;
  revisions := public.prune_entry_revisions();
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''14 days''';
    get diagnostics runs = row_count;
  end if;
  return jsonb_build_object('audit_log', audit, 'preview_links', previews,
                            'rate_limits', limits, 'entry_revisions', revisions,
                            'cron_runs', runs);
end;
$$;
revoke execute on function public.db_housekeeping() from public, anon, authenticated;
