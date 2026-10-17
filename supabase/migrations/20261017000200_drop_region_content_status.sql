-- =============================================================================
-- Drop regions.content_status (owner, 2026-10-17)
-- =============================================================================
--
-- Regions moved from the three-state `content_status` (none / preparing /
-- ready) to the two-state `content_progress` (planned / completed) in
-- 20261017000100, which backfilled the new column. The app live since that
-- deploy reads and writes only `content_progress`, so the old column goes.
-- Global issues keep their three states: `special_regions.content_status`
-- stays as it is.
--
-- Phase: contract. Follows the expand migration 20261017000100; the running
-- app no longer names `regions.content_status`.
--
-- The audit trigger names the column in its WHEN clause, so it is recreated
-- without it first (otherwise the drop is refused). The column's anon grant
-- and comment go with the column.
--
-- Covered by "region content progress" and "global issue content status" in
-- supabase/tests/rls.test.mjs.
-- =============================================================================

drop trigger if exists regions_audit on public.regions;
create trigger regions_audit
  after update on public.regions
  for each row
  when (auth.uid() is not null
    and (old.name, old.position, old.center_lon, old.center_lat, old.zoom, old.fill, old.stroke,
         old.content_progress)
      is distinct from
        (new.name, new.position, new.center_lon, new.center_lat, new.zoom, new.fill, new.stroke,
         new.content_progress))
  execute function public.audit_row('slug');

alter table public.regions drop constraint if exists regions_content_status;
alter table public.regions drop column if exists content_status;
