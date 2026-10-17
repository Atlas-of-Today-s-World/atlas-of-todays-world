-- =============================================================================
-- Region content: planned for the future, or completed (owner, 2026-10-17)
-- =============================================================================
--
-- A region now has two states instead of three (`content_status` none /
-- preparing / ready): its content is either planned for the future or
-- completed. Editors flip it with one button in /admin/regions; the globe draws
-- it as the mark on the region's and its countries' topic pills, the grey wash
-- of planned regions and the badge in the region's portrait. Global issues keep
-- their three states (`special_regions.content_status`).
--
-- Phase: expand. `regions.content_status` stays for the app that is live while
-- this runs; nothing reads it after this deploy, and a later contract migration
-- drops it. Starting values: completed where the region was ready (Middle East),
-- planned everywhere else — Eastern Europe, "in preparation" until now, too.
--
-- Covered by "region content progress" in supabase/tests/rls.test.mjs.
-- =============================================================================

alter table public.regions
  add column if not exists content_progress text not null default 'planned'
    constraint regions_content_progress check (content_progress in ('planned', 'completed'));

comment on column public.regions.content_progress is
  'planned = planned for the future, completed = the region''s content is done';

-- The globe and the portrait read it with the public client; writes go through
-- the existing policy regions_change (`regions` e).
grant select (content_progress) on public.regions to anon;

update public.regions set content_progress = 'completed'
  where content_status = 'ready' and content_progress = 'planned';

-- The audit of the facts the team changes on a region (20261013000300) now
-- also notes the new column.
drop trigger if exists regions_audit on public.regions;
create trigger regions_audit
  after update on public.regions
  for each row
  when (auth.uid() is not null
    and (old.name, old.position, old.center_lon, old.center_lat, old.zoom, old.fill, old.stroke,
         old.content_status, old.content_progress)
      is distinct from
        (new.name, new.position, new.center_lon, new.center_lat, new.zoom, new.fill, new.stroke,
         new.content_status, new.content_progress))
  execute function public.audit_row('slug');
