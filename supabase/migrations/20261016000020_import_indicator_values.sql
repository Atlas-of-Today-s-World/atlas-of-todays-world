-- =============================================================================
-- CSV import of a data layer's values (owner request, 2026-10-16)
-- =============================================================================
-- Why: Admin → Map data layers → a layer → "Import CSV" overwrites the layer's
-- values with a file. The browser reads the file and matches the countries;
-- this function writes the result in ONE transaction, so a failed import
-- leaves the layer as it was:
--
--   * p_replace = true:  countries missing from the file lose their value
--                        (needs Data layers "d", like deleting one value);
--   * p_replace = false: only the countries in the file are written.
--
-- Security invoker: every write goes through the indicator_values policies
-- (insert / update: regions or layers "e"; delete: layers "d"). The checks
-- at the top only turn a refusal into a sentence. Rows are stamped by
-- stamp_indicator_value() like any value a team member saves: is_manual = true
-- and the import's source in source_note (required for manual values) — so
-- the seed never overwrites an imported value. Rows whose value, year and
-- note are already the same are not written at all (they keep their origin).
--
-- Returns {added, changed, unchanged, removed}.
-- Phase: expand (a new function; the running app doesn't call it).
-- Default privileges are revoked (20261013000210): the grant below is explicit.
-- Tests: supabase/tests/indicator-import.test.mjs.
-- =============================================================================

create or replace function public.import_indicator_values(
  p_indicator text,
  p_rows jsonb,
  p_replace boolean,
  p_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_type text;
  v_bad text;
  v_total integer;
  v_added integer;
  v_changed integer;
  v_removed integer := 0;
  v_source text := btrim(coalesce(p_source, ''));
begin
  if not ((select has_perm('layers', 'e')) or (select has_perm('regions', 'e'))) then
    raise exception 'You can''t change the values of data layers.' using errcode = '42501';
  end if;

  select i.type into v_type from indicators i where i.id = p_indicator;
  if not found then
    raise exception 'This data layer doesn''t exist.' using errcode = '22023';
  end if;
  if length(v_source) not between 1 and 300 then
    raise exception 'The import needs a source of at most 300 characters.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 1000 then
    raise exception 'An import holds 1 to 1000 countries.' using errcode = '22023';
  end if;
  p_replace := coalesce(p_replace, false);

  -- Shape of each row: {country_iso3, value, year|null, note|null} (= ImportInput).
  select coalesce(e ->> 'country_iso3', '?') into v_bad
    from jsonb_array_elements(p_rows) e
   where jsonb_typeof(e) is distinct from 'object'
      or coalesce(e ->> 'country_iso3', '') !~ '^[A-Z]{3}$'
      or jsonb_typeof(e -> 'value') is distinct from 'number'
      or coalesce(jsonb_typeof(e -> 'year'), 'null') not in ('null', 'number')
      -- CASE: the cast runs only on a number (AND doesn't promise an order).
      or case when jsonb_typeof(e -> 'year') = 'number'
              then (e ->> 'year')::numeric not between 1800 and 2100
                   or (e ->> 'year')::numeric <> trunc((e ->> 'year')::numeric)
              else false end
      or coalesce(jsonb_typeof(e -> 'note'), 'null') not in ('null', 'string')
      or length(e ->> 'note') > 120
   limit 1;
  if found then
    raise exception 'The import row for % is not valid.', v_bad using errcode = '22023';
  end if;

  select r.country_iso3 into v_bad
    from jsonb_to_recordset(p_rows) r (country_iso3 text)
   group by r.country_iso3
  having count(*) > 1
   limit 1;
  if found then
    raise exception 'Country % appears more than once in the import.', v_bad using errcode = '22023';
  end if;

  select r.country_iso3 into v_bad
    from jsonb_to_recordset(p_rows) r (country_iso3 text)
   where not exists (select 1 from countries c where c.iso3 = r.country_iso3)
   limit 1;
  if found then
    raise exception 'Country code % is not in the Atlas.', v_bad using errcode = '22023';
  end if;

  -- A categorical layer stores category codes: each value must be one of them.
  if v_type = 'categorical'
     and exists (select 1 from indicator_categories c where c.indicator_id = p_indicator) then
    select r.value::text into v_bad
      from jsonb_to_recordset(p_rows) r (value numeric)
     where not exists (
       select 1 from indicator_categories c
        where c.indicator_id = p_indicator and c.value = r.value)
     limit 1;
    if found then
      raise exception 'Value % is not one of this layer''s categories.', v_bad using errcode = '22023';
    end if;
  end if;

  -- What the import will do, counted before it does it.
  select count(*),
         count(*) filter (where v.country_iso3 is null),
         count(*) filter (where v.country_iso3 is not null
                            and (v.value, v.year, v.note)
                                is distinct from (r.value, r.year, nullif(btrim(r.note), '')))
    into v_total, v_added, v_changed
    from jsonb_to_recordset(p_rows) r (country_iso3 text, value numeric, year integer, note text)
    left join indicator_values v
      on v.indicator_id = p_indicator and v.country_iso3 = r.country_iso3;

  if p_replace then
    if exists (
      select 1 from indicator_values v
       where v.indicator_id = p_indicator
         and not exists (
           select 1 from jsonb_to_recordset(p_rows) r (country_iso3 text)
            where r.country_iso3 = v.country_iso3)
    ) and not (select has_perm('layers', 'd')) then
      raise exception 'Replacing removes the countries missing from the file, which needs delete permission for data layers. Choose "Update only the countries in the file".'
        using errcode = '42501';
    end if;
    with gone as (
      delete from indicator_values v
       where v.indicator_id = p_indicator
         and not exists (
           select 1 from jsonb_to_recordset(p_rows) r (country_iso3 text)
            where r.country_iso3 = v.country_iso3)
      returning 1
    )
    select count(*) into v_removed from gone;
  end if;

  insert into indicator_values as v (indicator_id, country_iso3, value, year, note, source_note)
  select p_indicator, r.country_iso3, r.value, r.year, nullif(btrim(r.note), ''), v_source
    from jsonb_to_recordset(p_rows) r (country_iso3 text, value numeric, year integer, note text)
   where not exists (
     select 1 from indicator_values cur
      where cur.indicator_id = p_indicator
        and cur.country_iso3 = r.country_iso3
        and (cur.value, cur.year, cur.note)
            is not distinct from (r.value, r.year, nullif(btrim(r.note), '')))
  on conflict (indicator_id, country_iso3) do update
     set value = excluded.value,
         year = excluded.year,
         note = excluded.note,
         source_note = excluded.source_note;

  return jsonb_build_object(
    'added', v_added,
    'changed', v_changed,
    'unchanged', v_total - v_added - v_changed,
    'removed', v_removed
  );
end;
$$;

revoke execute on function public.import_indicator_values(text, jsonb, boolean, text) from public, anon;
grant execute on function public.import_indicator_values(text, jsonb, boolean, text) to authenticated;
