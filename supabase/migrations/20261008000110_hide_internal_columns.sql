-- =============================================================================
-- Who created or last changed public data stays with the team
-- =============================================================================
--
-- Security review S-L2 (the rest after 20261008000030). The tables below kept
-- the default table-wide SELECT grant, so anyone — anon included — could read
-- the team member's account id behind each row:
--
--   entry_chapters.created_by / updated_by
--   indicators.created_by
--   indicator_values.updated_by
--   map_areas.created_by
--   special_regions.created_by
--
-- Same approach as entries/authors/translations/redirects: the table-wide grant
-- goes, and every other column is granted by name. The public site already
-- lists its columns (never `select *`), so nothing it reads changes.
--
-- Who keeps what:
--   * entry_chapters — anon loses the two columns. `authenticated` keeps the
--     table-wide grant: the dossier editor shows who created and last changed
--     each subtopic (getEntryParts, session client) and replace_entry_parts()
--     (security invoker) reads them back. Readers are still kept away by RLS:
--     entry_chapters_read joins `entries` as the caller, and readers see no
--     entry rows through their session (20261008000030).
--   * indicators, indicator_values, map_areas, special_regions — readable by
--     every signed-in account (`using (true)`) and the admin never reads these
--     columns, so both anon and `authenticated` lose them. The columns are
--     still written: inserts send created_by (INSERT privilege is unchanged)
--     and the guard/stamp triggers set them.
--
-- A column added to one of these tables later must be granted here by name to
-- become readable (anon, and `authenticated` where noted above).
-- Tests: supabase/tests/column-grants.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- entry_chapters: anon only
-- ---------------------------------------------------------------------------

revoke select on public.entry_chapters from anon;
grant select (id, entry_id, position, title, summary_points, body_html, illustration_url,
  illustration_credit, audio_url, tile_background, created_at, updated_at)
  on public.entry_chapters to anon;

-- ---------------------------------------------------------------------------
-- Map data: anon and every signed-in account
-- ---------------------------------------------------------------------------

revoke select on public.indicators from anon, authenticated;
grant select (id, label, short_label, description, unit, decimals, source, source_url, type, scale,
  domain_min, domain_max, ramp, higher_is_better, latest_year, is_custom, updated_at, position)
  on public.indicators to anon, authenticated;

revoke select on public.indicator_values from anon, authenticated;
grant select (indicator_id, country_iso3, value, year, note, source_note, is_manual, updated_at)
  on public.indicator_values to anon, authenticated;

revoke select on public.map_areas from anon, authenticated;
grant select (id, slug, name, label, country_iso3, note, fill, stroke, geometry, created_at, updated_at)
  on public.map_areas to anon, authenticated;

revoke select on public.special_regions from anon, authenticated;
grant select (slug, name, subtitle, summary, fill, stroke, center_lon, center_lat, zoom, updated_at,
  timeline_title, timeline_subtitle, intro, hero_url, hero_credit, kind, content_status)
  on public.special_regions to anon, authenticated;
