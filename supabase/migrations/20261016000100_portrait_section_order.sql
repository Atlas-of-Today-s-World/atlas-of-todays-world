-- =============================================================================
-- One order of portrait sections for the whole site (owner, 2026-10-16)
-- =============================================================================
--
-- From the call with the Atlas team: a country, a region and a global issue
-- show the same run of sections — in the side-panel preview and on the full
-- page — and the editors choose its order in the admin (Portrait layout):
--
--   timeline · topics (four theme rows) · visuals (maps & charts)
--   · resources (learn more) · faq
--
-- The intro and the key facts stay on top, outside the list.
--
-- Stored on the single site_settings row: it is site-wide configuration like
-- the brand and SEO defaults there, read publicly on every portrait and
-- written by the same people (section `site`, right "e" — the existing
-- site_settings_update policy decides, no new policy needed).
--
-- The CHECK accepts exactly a permutation of the five keys: every key present
-- (`allowed <@ value`), nothing else (`value <@ allowed`) and five entries —
-- which with both containments rules out repeats. The app normalises what it
-- reads anyway (src/features/portraits/section-order.ts), so a sixth section
-- added later appears on sites whose stored order predates it.
--
-- Phase: EXPAND only. A new column with a default; nothing renamed or
-- dropped. The code live before this deploy names its columns and never reads
-- this one, so it keeps working while deploy.yml migrates first.
--
-- Covered by: supabase/tests/site-settings.test.mjs ("portrait layout: …" —
-- default order, who may reorder, anon read grant, the CHECK).
-- =============================================================================

alter table public.site_settings
  add column portrait_sections text[] not null
    default array['timeline', 'topics', 'visuals', 'resources', 'faq']::text[]
    constraint site_settings_portrait_sections_check check (
      cardinality(portrait_sections) = 5
      and portrait_sections <@ array['timeline', 'topics', 'visuals', 'resources', 'faq']::text[]
      and array['timeline', 'topics', 'visuals', 'resources', 'faq']::text[] <@ portrait_sections
    );

comment on column public.site_settings.portrait_sections is
  'Order of the portrait sections on every country, region and global issue (Admin → Portrait layout).';

-- Explicit column grants, as for the other columns of this table: the public
-- site reads the order, the admin updates it (RLS: site "e").
grant select (portrait_sections) on public.site_settings to anon;
grant update (portrait_sections) on public.site_settings to authenticated;
