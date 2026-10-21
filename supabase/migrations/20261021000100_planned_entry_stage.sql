-- =============================================================================
-- Planned topics: what their greyed tile says (owner, 2026-10-21)
-- =============================================================================
--
-- A planned topic (status `planned`) is a greyed tile with its title in its
-- theme's row on the portraits. Over the title it says where the topic
-- stands, chosen in the admin:
--
--   in_preparation  — "In preparation": someone is on it;
--   seeking_authors — "Seeking authors": nobody yet, the Atlas looks for one.
--
-- Expand-only: a column with a default and planned_entries() returning it.
-- The function's result changes, so it is dropped and created again (with its
-- grants); an app from before this migration ignores the extra column.
-- =============================================================================

alter table public.entries
  add column planned_stage text not null default 'in_preparation'
    constraint entries_planned_stage_check
      check (planned_stage in ('in_preparation', 'seeking_authors'));

drop function public.planned_entries();

create function public.planned_entries()
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
  order by e.title
  limit 500
$$;

revoke execute on function public.planned_entries() from public;
grant execute on function public.planned_entries() to anon, authenticated;
