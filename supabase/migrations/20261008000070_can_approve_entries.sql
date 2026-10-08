-- Approval queue in one round trip (review 2026-10-07, D-M1): the admin asked
-- can_approve_entry() once per pending article — up to 200 parallel HTTP
-- requests competing for the small connection pool. This answers for a whole
-- list at once with exactly the same rule (can_approve_entry per id).

create function public.can_approve_entries(p_entries uuid[])
returns table (entry_id uuid, can_approve boolean)
language sql stable
set search_path = public, pg_temp
as $$
  select id, public.can_approve_entry(id)
  from unnest(p_entries[1:500]) as id
$$;
revoke execute on function public.can_approve_entries(uuid[]) from public, anon;
grant execute on function public.can_approve_entries(uuid[]) to authenticated;
