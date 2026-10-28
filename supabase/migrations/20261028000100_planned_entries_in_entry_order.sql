-- =============================================================================
-- Planned topics in the order they were entered (owner, 2026-10-28)
-- =============================================================================
--
-- The greyed tiles of a portrait's entry plan follow the order in which the
-- editors entered the planned topics (their numbered list), not the alphabet.
-- Topics entered in one go keep the title as the tie-break.
--
-- Same signature and result as 20261021000100_planned_entry_stage: only the
-- order changes, so the function is replaced in place and keeps its grants.
-- =============================================================================

create or replace function public.planned_entries()
returns table (
  title          text,
  category       text,
  region_slug    text,
  special_slug   text,
  countries      text[],
  planned_stage  text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.title, e.category, e.region_slug, e.special_slug,
         coalesce((select array_agg(c.country_iso3 order by c.country_iso3)
                     from entry_countries c where c.entry_id = e.id), '{}'),
         e.planned_stage
  from entries e
  where e.kind = 'entry' and e.status = 'planned' and e.translation_of is null
  order by e.created_at, e.title
  limit 500
$$;
