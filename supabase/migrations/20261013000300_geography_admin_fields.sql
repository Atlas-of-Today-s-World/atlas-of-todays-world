-- =============================================================================
-- Geography in the admin: the rest of the region, country and layer fields
-- =============================================================================
--
-- Regions stay created by the import (they are tied to the map geometry), but
-- everything else about them is edited in /admin/regions: now also where the
-- globe turns to (center_lon / center_lat / zoom) and their order. Countries
-- gain their facts (name, formal name, population, UN subregion, status note);
-- lon / lat / bbox stay import-only. Data layers get an order and a latest
-- year that follows the values the team enters.
--
-- No new columns: regions and countries keep their table-wide grants (anon and
-- `authenticated` select, `authenticated` update — RLS limits the update to
-- section `regions` "e"), so nothing new needs granting. New functions get
-- explicit execute rights (no reliance on default privileges).
--
--   1. CHECKs for the new form fields (the same limits as the Zod schemas in
--      src/features/portraits/schema.ts). Validated: the seed fits them and
--      nobody could edit these columns before (supabase/tests/geography-admin.test.mjs).
--   2. move_region() / move_indicator(): one step up or down, renumbering the
--      list (10, 20, …) in one transaction. Security invoker — the update
--      policies decide (regions "e" / layers "e"); without the right nothing
--      changes and the call is refused.
--   3. indicators.latest_year follows the values entered by hand: after a value
--      is written or removed by a team member, the layer's latest year is the
--      newest year among its values (kept as it is when no value has a year).
--      Imports (service key, no auth.uid()) set it themselves.
--   4. Audit of the facts the team now changes on regions and countries.
--   5. map_areas.note is an internal note for the team (where the shape comes
--      from): the public site never showed it, so anon no longer reads it.
--   6. The region tagline imported from the old site ("A Comprehensive
--      Portrait with global perspective", the same on every region) is
--      boilerplate. The portrait now shows the tagline under the name, so it is
--      cleared where it is exactly that text: only taglines the editors wrote
--      appear. The column is NOT NULL (default ''), so "none" is ''.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Limits of the new form fields
-- ---------------------------------------------------------------------------

-- The same zoom range as a global issue (special_regions_zoom_check);
-- the centre ranges were there from the start.
alter table public.regions
  add constraint regions_zoom_check check (zoom between 0.5 and 9) not valid;
alter table public.regions validate constraint regions_zoom_check;

alter table public.countries
  add constraint countries_name_check check (length(btrim(name)) between 1 and 120) not valid,
  add constraint countries_name_formal_len check (length(name_formal) <= 200) not valid,
  add constraint countries_un_subregion_len check (length(un_subregion) <= 60) not valid,
  add constraint countries_territory_note_len check (length(territory_note) <= 1000) not valid,
  -- Twenty billion: above any country, below anything a typo could make look plausible.
  add constraint countries_population_max check (population <= 20000000000) not valid;
alter table public.countries validate constraint countries_name_check;
alter table public.countries validate constraint countries_name_formal_len;
alter table public.countries validate constraint countries_un_subregion_len;
alter table public.countries validate constraint countries_territory_note_len;
alter table public.countries validate constraint countries_population_max;

-- ---------------------------------------------------------------------------
-- 2. Order of regions and data layers
-- ---------------------------------------------------------------------------

create or replace function public.move_region(p_slug text, p_up boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  slugs text[];
  i integer;
  j integer;
  changed integer;
begin
  -- The order the public site reads (features/geography/queries.ts).
  select array_agg(slug order by position, slug) into slugs from regions;
  i := array_position(slugs, p_slug);
  if i is null then
    raise exception 'The region no longer exists.' using errcode = '22023';
  end if;
  j := case when p_up then i - 1 else i + 1 end;
  if j < 1 or j > cardinality(slugs) then
    return;  -- already first / last
  end if;
  slugs[i] := slugs[j];
  slugs[j] := p_slug;
  update regions r
     set position = o.pos * 10
    from unnest(slugs) with ordinality as o (slug, pos)
   where r.slug = o.slug and r.position is distinct from o.pos * 10;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'You can''t reorder the regions.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.move_region(text, boolean) from public, anon;
grant execute on function public.move_region(text, boolean) to authenticated;

create or replace function public.move_indicator(p_id text, p_up boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  ids text[];
  i integer;
  j integer;
  changed integer;
begin
  select array_agg(id order by position, id) into ids from indicators;
  i := array_position(ids, p_id);
  if i is null then
    raise exception 'The data layer no longer exists.' using errcode = '22023';
  end if;
  j := case when p_up then i - 1 else i + 1 end;
  if j < 1 or j > cardinality(ids) then
    return;
  end if;
  ids[i] := ids[j];
  ids[j] := p_id;
  update indicators x
     set position = o.pos * 10
    from unnest(ids) with ordinality as o (id, pos)
   where x.id = o.id and x.position is distinct from o.pos * 10;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'You can''t reorder the data layers.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.move_indicator(text, boolean) from public, anon;
grant execute on function public.move_indicator(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Latest year of a layer follows the values entered by hand
-- ---------------------------------------------------------------------------
-- Security definer: a team member with `regions` "e" may write values but not
-- the layer's definition (`layers` "e"). It only ever sets latest_year, and
-- only to what the values say.

create or replace function public.refresh_indicator_latest_year()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  layers text[] := '{}';
  layer text;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    layers := layers || new.indicator_id;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and not (old.indicator_id = any (layers)) then
    layers := layers || old.indicator_id;
  end if;
  foreach layer in array layers loop
    update indicators i
       set latest_year = v.newest
      from (select max(year) as newest from indicator_values where indicator_id = layer) v
     where i.id = layer
       and v.newest is not null
       and i.latest_year is distinct from v.newest;
  end loop;
  return null;
end;
$$;

revoke execute on function public.refresh_indicator_latest_year() from public, anon, authenticated;

create trigger indicator_values_latest_year
  after insert or update or delete on public.indicator_values
  for each row when (auth.uid() is not null)
  execute function public.refresh_indicator_latest_year();

-- ---------------------------------------------------------------------------
-- 4. Audit: the facts the team changes on regions and countries
-- ---------------------------------------------------------------------------
-- Only changes by a team member (imports run without auth.uid()), and only
-- when a fact changed — not every save of a portrait text.

create trigger regions_audit
  after update on public.regions
  for each row
  when (auth.uid() is not null
    and (old.name, old.position, old.center_lon, old.center_lat, old.zoom, old.fill, old.stroke,
         old.content_status)
      is distinct from
        (new.name, new.position, new.center_lon, new.center_lat, new.zoom, new.fill, new.stroke,
         new.content_status))
  execute function public.audit_row('slug');

create trigger countries_audit
  after update on public.countries
  for each row
  when (auth.uid() is not null
    and (old.name, old.name_formal, old.population, old.un_subregion, old.territory_note,
         old.region_slug)
      is distinct from
        (new.name, new.name_formal, new.population, new.un_subregion, new.territory_note,
         new.region_slug))
  execute function public.audit_row('iso3');

-- ---------------------------------------------------------------------------
-- 5. map_areas.note stays with the team
-- ---------------------------------------------------------------------------
-- Signed-in accounts keep it: the admin reads it with the user's session.

revoke select (note) on public.map_areas from anon;

-- ---------------------------------------------------------------------------
-- 6. No boilerplate tagline under a region's name
-- ---------------------------------------------------------------------------
-- Exact, case-sensitive match: a tagline an editor changed in any way stays.

update public.regions
   set tagline = ''
 where tagline = 'A Comprehensive Portrait with global perspective';
