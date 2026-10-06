-- =============================================================================
-- Antarctica as a region without metrics (topics can be placed on it)
-- =============================================================================
--
-- Antarctica had no region, so in the Regions layer it could not be clicked
-- and no topic could be placed on it. It becomes a region of its own; its
-- portrait shows no indicator cards (`show_metrics = false`), since no
-- country data describe it.
-- =============================================================================

alter table public.regions
  add column show_metrics boolean not null default true;

grant select (show_metrics) on public.regions to anon;

insert into public.regions (slug, name, tagline, fill, stroke, center_lon, center_lat, zoom, summary, position, show_metrics)
values (
  'antarctica', 'Antarctica', 'The frozen continent', '#dfe8f1', '#7f9bb8', 0, -82, 1.6,
  'Antarctica is the coldest, driest and windiest continent, almost entirely covered by ice up to four kilometres thick. It has no permanent population; scientists from dozens of countries live at research stations. Under the Antarctic Treaty of 1959 the continent is reserved for peaceful purposes and science, territorial claims are frozen and mining is banned — while its ice sheets hold the key to future sea levels.',
  9, false
)
on conflict (slug) do nothing;

-- The seed snapshot leaves Antarctica without a region; give it its own.
update public.countries set region_slug = 'antarctica' where iso3 = 'ATA' and region_slug is null;
