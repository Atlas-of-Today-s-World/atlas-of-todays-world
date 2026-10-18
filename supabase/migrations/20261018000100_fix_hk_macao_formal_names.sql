-- =============================================================================
-- Hong Kong and Macao formal names (2026-10-18)
-- =============================================================================
--
-- The Special → Issue rename in c223ea9 also hit the formal names of Hong Kong
-- and Macao: "Hong Kong Issue Administrative Region, PRC". Natural Earth (and
-- src/data/countries.generated.json since b34f6b9) has "Special Administrative
-- Region". Only rows still holding the broken name change, so an edit made in
-- the admin since then stays.
--
-- Phase: data only, no schema change.
-- =============================================================================

update public.countries
set name_formal = replace(name_formal, 'Issue Administrative Region', 'Special Administrative Region')
where iso3 in ('HKG', 'MAC')
  and name_formal like '% Issue Administrative Region, PRC';
