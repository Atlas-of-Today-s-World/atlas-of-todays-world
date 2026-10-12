-- =============================================================================
-- Schedule drop on part changes: once per statement (review 2026-10-07, D-L3)
-- =============================================================================
--
-- 20261007000010 added row-level triggers on the six entry part tables that
-- cancel a scheduled publication when someone other than the scheduler
-- changes a part. replace_entry_parts() rewrites a part list as
-- "delete all + insert all", so saving 30 subtopics ran the trigger 60 times,
-- each with its own UPDATE of `entries`. The same check now runs once per
-- statement over the changed rows (transition tables). Who triggers the drop
-- and when is unchanged; an UPDATE that moves a part to another entry now
-- drops the plan of both entries (before only the new one's — such moves
-- don't happen in the app).
--
-- sync_resource_tile (also reviewed under D-L3) stays a row trigger: it is a
-- BEFORE trigger that fills in NEW.tile_id / NEW.kind for each inserted row,
-- and it already fires on UPDATE only when kind or tile_id is written.
-- =============================================================================

create or replace function public.drop_schedule_on_parts_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- Service key / database jobs (no signed-in user) never drop a plan.
  if auth.uid() is null then
    return null;
  end if;
  -- Each branch reads only the transition tables its event has.
  if tg_op = 'INSERT' then
    update entries e
       set publish_at = null, scheduled_by = null
     where e.id in (select n.entry_id from new_rows n)
       and e.publish_at is not null
       and e.scheduled_by is distinct from (select auth.uid());
  elsif tg_op = 'UPDATE' then
    update entries e
       set publish_at = null, scheduled_by = null
     where e.id in (select n.entry_id from new_rows n union select o.entry_id from old_rows o)
       and e.publish_at is not null
       and e.scheduled_by is distinct from (select auth.uid());
  else
    update entries e
       set publish_at = null, scheduled_by = null
     where e.id in (select o.entry_id from old_rows o)
       and e.publish_at is not null
       and e.scheduled_by is distinct from (select auth.uid());
  end if;
  return null;
end;
$$;
revoke execute on function public.drop_schedule_on_parts_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['entry_chapters', 'entry_faq', 'entry_tile_notes', 'resources',
                           'learn_more_tiles', 'entry_countries'] loop
    execute format('drop trigger %I on public.%I', t || '_drop_schedule', t);
    execute format(
      'create trigger %I after insert on public.%I
         referencing new table as new_rows
         for each statement execute function public.drop_schedule_on_parts_change()',
      t || '_drop_schedule_ins', t);
    execute format(
      'create trigger %I after update on public.%I
         referencing old table as old_rows new table as new_rows
         for each statement execute function public.drop_schedule_on_parts_change()',
      t || '_drop_schedule_upd', t);
    execute format(
      'create trigger %I after delete on public.%I
         referencing old table as old_rows
         for each statement execute function public.drop_schedule_on_parts_change()',
      t || '_drop_schedule_del', t);
  end loop;
end;
$$;

drop function public.drop_schedule_on_part_change();
