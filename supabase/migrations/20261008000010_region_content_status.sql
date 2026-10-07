-- =============================================================================
-- Content status of regions and global issues (fundraising, 2026-10-07)
-- =============================================================================
--
-- The site is now mainly for raising support. Content is written per region
-- (only Middle East so far, Eastern Europe soon), and a visitor should see at
-- a glance what is done, what is being written and what waits for Atlas Patrons:
--   none      – not started (grey on the globe, a call for support in the portrait)
--   preparing – in preparation (hourglass next to the topic count)
--   ready     – done (check mark next to the topic count)
-- The same for global issues (`special_regions`). Editors change it in the
-- region / issue admin; writes are guarded by the existing policies
-- regions_change (`regions` e) and special_regions_change (`specials` e).
-- =============================================================================

alter table public.regions
  add column content_status text not null default 'none'
    constraint regions_content_status check (content_status in ('none', 'preparing', 'ready'));

alter table public.special_regions
  add column content_status text not null default 'none'
    constraint special_regions_content_status check (content_status in ('none', 'preparing', 'ready'));

comment on column public.regions.content_status is
  'none = not started, preparing = in preparation, ready = done';
comment on column public.special_regions.content_status is
  'none = not started, preparing = in preparation, ready = done';

-- The globe and the portrait read it with the public client.
grant select (content_status) on public.regions to anon;
grant select (content_status) on public.special_regions to anon;

-- Starting point from the meeting: Middle East is done, Eastern Europe in preparation.
-- Only where regions with these slugs exist (otherwise the UPDATE changes nothing).
update public.regions set content_status = 'ready' where slug = 'middle-east-north-africa';
update public.regions set content_status = 'preparing' where slug = 'eastern-europe-central-asia';
