-- Role holder counts for the Roles & permissions page (review 2026-10-07, D-M4).
--
-- The page loaded up to 5000 profile rows just to count them — and PostgREST
-- caps a response at max_rows = 1000 anyway. The count now happens here.
--
-- SECURITY DEFINER on purpose: the page needs `permissions` view, but profiles
-- RLS shows other accounts only to `users`/`members` viewers, so under the
-- caller's rights an access manager without those would count only themselves.
-- The function checks `permissions` view itself and returns aggregates only.

create function public.role_holder_counts()
returns table (role_id text, holders bigint)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (select public.has_perm('permissions', 'v')) then
    raise exception 'Only someone who may view permissions can count role holders.'
      using errcode = '42501';
  end if;
  return query
    select p.role_id, count(*)::bigint
    from profiles p
    where p.deleted_at is null
    group by p.role_id;
end;
$$;
revoke execute on function public.role_holder_counts() from public, anon;
grant execute on function public.role_holder_counts() to authenticated;
