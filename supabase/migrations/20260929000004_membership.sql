-- =============================================================================
-- Členství (Atlas Patrons) a návštěvnost přihlášených účtů
-- =============================================================================
--
-- Platby: Stripe Checkout (hostovaná stránka) + webhook. Údaje o kartě
-- nikdy neprojdou aplikací ani databází. Placené členství zapisuje výhradně
-- webhook servisním klíčem; admin smí ručně dát jen členství zdarma.
--
-- Návštěvnost: jen souhrn počtu přečtených stránek na účet a den. Žádné
-- adresy, žádná historie jednotlivých stránek. Je to osobní údaj (GDPR) —
-- v zásadách zpracování musí být napsané, že se počítá a proč.
-- =============================================================================

create table public.memberships (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  plan                    text not null default 'none' check (plan in ('none', 'patron', 'founding', 'institution')),
  status                  text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'incomplete')),
  complimentary           boolean not null default false,
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  started_at              timestamptz,
  current_period_end      timestamptz,
  updated_at              timestamptz not null default now(),
  check (not complimentary or stripe_subscription_id is null)
);

create table public.page_views_daily (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null default current_date,
  views    integer not null default 0 check (views >= 0),
  primary key (user_id, day)
);

create trigger memberships_stamp before update on public.memberships
  for each row execute function public.stamp_row();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_row('user_id');

-- Ručně jen členství zdarma, a jen admin. Placené řídí Stripe.
create or replace function public.guard_memberships()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);  -- webhook servisním klíčem
  end if;
  if not is_admin() then
    raise exception 'Only an admin can grant a membership by hand.' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' and (not new.complimentary or new.stripe_subscription_id is not null
     or new.stripe_customer_id is distinct from (case when tg_op = 'UPDATE' then old.stripe_customer_id end)) then
    raise exception 'Paid memberships are managed by the payment provider.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_guard
  before insert or update or delete on public.memberships
  for each row execute function public.guard_memberships();

-- Jedna stránka přečtená přihlášeným účtem. Volá se ze serveru, ne z prohlížeče.
create or replace function public.record_page_view()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into page_views_daily (user_id, day, views)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set views = page_views_daily.views + 1;
  update profiles set last_seen_at = now() where id = auth.uid();
end;
$$;

-- Přehled pro sekci Members & billing. `security_invoker`: čte se s právy
-- toho, kdo se ptá, takže RLS profilů i členství platí i tady.
create view public.members_overview
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.email,
  p.kind,
  p.status,
  p.role_id,
  p.created_at as joined_at,
  p.last_seen_at,
  coalesce(m.plan, 'none') as plan,
  m.status as membership_status,
  m.complimentary,
  m.started_at as paying_since,
  m.current_period_end,
  coalesce((select sum(v.views) from page_views_daily v where v.user_id = p.id), 0) as pages_read
from profiles p
left join memberships m on m.user_id = p.id
where p.deleted_at is null;

alter table public.memberships enable row level security;
alter table public.page_views_daily enable row level security;

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or has_perm('members', 'v'));
create policy memberships_write on public.memberships for all to authenticated
  using (is_admin()) with check (is_admin() and complimentary);

create policy page_views_read on public.page_views_daily for select to authenticated
  using (user_id = auth.uid() or has_perm('members', 'v'));

grant select on public.memberships, public.page_views_daily, public.members_overview to authenticated;
grant insert, update, delete on public.memberships to authenticated;
revoke execute on function public.record_page_view() from public, anon;
grant execute on function public.record_page_view() to authenticated;
