-- =============================================================================
-- Atlas Patrons: public progress towards the current goal (/membership)
-- =============================================================================
--
-- The public page shows "N / 1 000 patrons" and "EUR X of 10,000 per month".
-- Anonymous readers must never see individual memberships, so they get only
-- an aggregate through a SECURITY DEFINER function (one row, two numbers).
--
-- `monthly_amount_cents` is the recurring monthly amount of a paid
-- membership. It is written only by the payment webhook (service key,
-- guard_memberships); complimentary memberships carry no amount.
-- =============================================================================

alter table public.memberships
  add column monthly_amount_cents integer
    check (monthly_amount_cents is null or monthly_amount_cents between 0 and 100000000),
  add constraint memberships_complimentary_no_amount
    check (not complimentary or monthly_amount_cents is null);

create or replace function public.patron_stats()
returns table (patrons integer, monthly_cents bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer,
         coalesce(sum(monthly_amount_cents), 0)::bigint
  from memberships
  where status = 'active' and plan <> 'none';
$$;

revoke execute on function public.patron_stats() from public;
grant execute on function public.patron_stats() to anon, authenticated;
