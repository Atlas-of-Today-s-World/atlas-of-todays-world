/**
 * Data changes made by migrations, for the harnesses that compare search()
 * before and after a set of migrations (db-low-findings, topic-search,
 * search-helpers-hardening). Those load the seed, snapshot the searches, then
 * apply every later migration — including ones that change searchable rows.
 * Applying these data changes before the first snapshot too keeps the
 * comparison about the search functions, on the same rows.
 *
 * Keep each statement identical to its migration.
 */
export const LATER_DATA_CHANGES = `
  -- 20261013000300_geography_admin_fields: no boilerplate region tagline.
  update public.regions
     set tagline = ''
   where tagline = 'A Comprehensive Portrait with global perspective';
`;
