-- =============================================================================
-- Stripe payments (ADR G6): monthly donations become memberships
-- =============================================================================
--
-- Phase: expand only. New tables and functions; guard_memberships() and
-- patron_stats() are replaced by supersets of their old behaviour, so the app
-- before this migration keeps working.
--
-- Flow: the "Donate & Join" action opens a hosted Stripe Checkout page (card
-- data never reaches Atlas). The webhook (/api/stripe/webhook, service key)
-- reports every change of a subscription through apply_stripe_subscription():
--  - a subscription already linked to a membership is updated in place;
--  - otherwise the donor is matched to an account (the account id Checkout
--    was opened with, else a CONFIRMED account e-mail equal to the Stripe
--    e-mail) and gets a paid membership;
--  - a donor without an account is kept in pending_memberships (e-mail,
--    Stripe ids, amount, status) until they sign in: claim_my_donations(),
--    called after every sign-in, moves the row to their membership. A pending
--    row is deleted as soon as its subscription ends, so the table only holds
--    running donations (retention stated on the privacy page below).
-- One-time donations create no membership and are not stored here at all.
--
-- stripe_events keeps the ids of processed webhook events (no payload, no
-- personal data) so a redelivered event is skipped; ids older than 30 days
-- are pruned on the next event (Stripe retries for up to 3 days).
--
-- Access: both tables are server-only (RLS on, no policy, no grant to anon or
-- authenticated); the webhook functions run only with the service key;
-- claim_my_donations() only for the signed-in caller's confirmed e-mail.
-- Tests: supabase/tests/stripe-payments.test.mjs.
-- =============================================================================

create table public.stripe_events (
  id          text primary key check (id ~ '^evt_[A-Za-z0-9]{1,250}$'),
  type        text not null check (length(type) between 1 and 100),
  received_at timestamptz not null default now()
);

create index stripe_events_received on public.stripe_events (received_at);

create table public.pending_memberships (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]{1,250}$'),
  stripe_customer_id     text not null check (stripe_customer_id ~ '^cus_[A-Za-z0-9]{1,250}$'),
  email                  text not null check (length(email) between 3 and 320 and email = lower(email)),
  status                 text not null check (status in ('active', 'past_due', 'incomplete')),
  monthly_amount_cents   integer check (monthly_amount_cents is null or monthly_amount_cents between 0 and 100000000),
  started_at             timestamptz,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

comment on table public.pending_memberships is
  'Monthly donations by people without an Atlas account yet. Server only; deleted when the subscription ends or the donor signs in.';

create index pending_memberships_email on public.pending_memberships (email);

create trigger pending_memberships_stamp before update on public.pending_memberships
  for each row execute function public.stamp_row();

alter table public.stripe_events enable row level security;
alter table public.pending_memberships enable row level security;
revoke all on public.stripe_events, public.pending_memberships from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guard: as before, plus the one-transaction grant claim_my_donations() sets
-- for the caller (the same mechanism as accept_invitation_for()).
-- ---------------------------------------------------------------------------
create or replace function public.guard_memberships()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);  -- the payment webhook (service key)
  end if;
  if exists (select 1 from internal_profile_grants g
             where g.tx = txid_current() and g.user_id = coalesce(new.user_id, old.user_id)) then
    return coalesce(new, old);  -- claim_my_donations() for the caller
  end if;
  if not is_admin() then
    raise exception 'Only an admin can grant a membership by hand.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    if not old.complimentary or old.stripe_subscription_id is not null then
      raise exception 'Paid memberships are managed by the payment provider.' using errcode = '42501';
    end if;
    return old;
  end if;
  if not new.complimentary or new.stripe_subscription_id is not null
     or new.stripe_customer_id is distinct from (case when tg_op = 'UPDATE' then old.stripe_customer_id end) then
    raise exception 'Paid memberships are managed by the payment provider.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_memberships() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Webhook: event ids
-- ---------------------------------------------------------------------------

-- True when the event was already processed; otherwise records it.
create or replace function public.stripe_event_seen(p_id text, p_type text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from stripe_events where received_at < now() - interval '30 days';
  insert into stripe_events (id, type) values (p_id, p_type) on conflict (id) do nothing;
  return not found;
end;
$$;

-- Processing failed: forget the id so Stripe's retry is handled again.
create or replace function public.stripe_event_forget(p_id text)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from stripe_events where id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- Webhook: the current state of one subscription
-- ---------------------------------------------------------------------------
-- p_status: 'active' | 'past_due' | 'incomplete' | 'canceled' (the app maps
-- Stripe's statuses). Returns what happened: 'member', 'pending' or 'removed'.
create or replace function public.apply_stripe_subscription(
  p_subscription  text,
  p_customer      text,
  p_email         text,
  p_status        text,
  p_user          uuid default null,
  p_monthly_cents integer default null,
  p_started_at    timestamptz default null,
  p_period_end    timestamptz default null
)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_user  uuid;
  v_row   memberships%rowtype;
begin
  if p_status not in ('active', 'past_due', 'incomplete', 'canceled') then
    raise exception 'Unknown subscription status.' using errcode = '22023';
  end if;

  -- 1. Already a membership: follow Stripe.
  update memberships
     set status = p_status, stripe_customer_id = p_customer,
         monthly_amount_cents = p_monthly_cents, current_period_end = p_period_end,
         started_at = coalesce(started_at, p_started_at)
   where stripe_subscription_id = p_subscription;
  if found then
    delete from pending_memberships where stripe_subscription_id = p_subscription;
    return 'member';
  end if;

  if p_status = 'canceled' then
    delete from pending_memberships where stripe_subscription_id = p_subscription;
    return 'removed';
  end if;

  -- 2. The donor's account: the one Checkout was opened with, else a confirmed e-mail.
  select p.id into v_user from profiles p
   where p.id = p_user and p.deleted_at is null;
  if v_user is null and v_email <> '' then
    select p.id into v_user
      from auth.users u join profiles p on p.id = u.id
     where lower(u.email) = v_email and u.email_confirmed_at is not null and p.deleted_at is null
     limit 1;
  end if;

  if v_user is not null then
    select * into v_row from memberships where user_id = v_user;
    -- Never replace another running paid membership, nor take a Stripe customer
    -- that belongs to another account (UNIQUE); such a donation stays pending.
    if (not found or v_row.complimentary or v_row.stripe_subscription_id is null
        or v_row.status <> 'active')
       and not exists (select 1 from memberships m
                        where m.stripe_customer_id = p_customer and m.user_id <> v_user) then
      insert into memberships (user_id, plan, status, complimentary, stripe_customer_id,
                               stripe_subscription_id, monthly_amount_cents, started_at,
                               current_period_end)
      values (v_user, 'patron', p_status, false, p_customer, p_subscription, p_monthly_cents,
              coalesce(p_started_at, now()), p_period_end)
      on conflict (user_id) do update
        set plan = 'patron', status = excluded.status, complimentary = false,
            stripe_customer_id = excluded.stripe_customer_id,
            stripe_subscription_id = excluded.stripe_subscription_id,
            monthly_amount_cents = excluded.monthly_amount_cents,
            started_at = excluded.started_at, current_period_end = excluded.current_period_end;
      delete from pending_memberships where stripe_subscription_id = p_subscription;
      return 'member';
    end if;
  end if;

  -- 3. No account (yet): keep it until the donor signs in.
  if v_email = '' then
    raise exception 'A donation without an account needs an e-mail.' using errcode = '22023';
  end if;
  insert into pending_memberships (stripe_subscription_id, stripe_customer_id, email, status,
                                   monthly_amount_cents, started_at, current_period_end)
  values (p_subscription, p_customer, v_email, p_status, p_monthly_cents,
          coalesce(p_started_at, now()), p_period_end)
  on conflict (stripe_subscription_id) do update
    set stripe_customer_id = excluded.stripe_customer_id, email = excluded.email,
        status = excluded.status, monthly_amount_cents = excluded.monthly_amount_cents,
        current_period_end = excluded.current_period_end;
  return 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- After sign-in: donations made before the account existed
-- ---------------------------------------------------------------------------
-- Moves the newest pending donation to the caller's confirmed e-mail into
-- their membership (unless they already have a running paid one). Returns
-- true when it did.
create or replace function public.claim_my_donations()
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me      uuid := auth.uid();
  v_email text := public.my_confirmed_email();
  v_row   memberships%rowtype;
  pending pending_memberships%rowtype;
begin
  if me is null or v_email is null then
    return false;
  end if;
  select * into pending from pending_memberships
   where email = v_email
   order by (status = 'active') desc, updated_at desc
   limit 1
   for update;
  if not found then
    return false;
  end if;
  select * into v_row from memberships where user_id = me;
  if (found and not v_row.complimentary and v_row.stripe_subscription_id is not null
      and v_row.status = 'active')
     or exists (select 1 from memberships m
                 where m.stripe_customer_id = pending.stripe_customer_id and m.user_id <> me) then
    return false;
  end if;

  insert into internal_profile_grants (user_id) values (me) on conflict do nothing;
  insert into memberships (user_id, plan, status, complimentary, stripe_customer_id,
                           stripe_subscription_id, monthly_amount_cents, started_at,
                           current_period_end)
  values (me, 'patron', pending.status, false, pending.stripe_customer_id,
          pending.stripe_subscription_id, pending.monthly_amount_cents, pending.started_at,
          pending.current_period_end)
  on conflict (user_id) do update
    set plan = 'patron', status = excluded.status, complimentary = false,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        monthly_amount_cents = excluded.monthly_amount_cents,
        started_at = excluded.started_at, current_period_end = excluded.current_period_end;
  delete from pending_memberships where stripe_subscription_id = pending.stripe_subscription_id;
  delete from internal_profile_grants where tx = txid_current() and user_id = me;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public goal: patrons without an account count too
-- ---------------------------------------------------------------------------
create or replace function public.patron_stats()
returns table (patrons integer, monthly_cents bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (m.patrons + p.patrons)::integer, (m.cents + p.cents)::bigint
  from (select count(*) as patrons, coalesce(sum(monthly_amount_cents), 0) as cents
          from memberships where status = 'active' and plan <> 'none') m,
       (select count(*) as patrons, coalesce(sum(monthly_amount_cents), 0) as cents
          from pending_memberships where status = 'active') p;
$$;

revoke execute on function public.patron_stats() from public;
grant execute on function public.patron_stats() to anon, authenticated;

revoke execute on function public.stripe_event_seen(text, text) from public, anon, authenticated;
revoke execute on function public.stripe_event_forget(text) from public, anon, authenticated;
revoke execute on function public.apply_stripe_subscription(text, text, text, text, uuid, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.stripe_event_seen(text, text) to service_role;
grant execute on function public.stripe_event_forget(text) to service_role;
grant execute on function public.apply_stripe_subscription(text, text, text, text, uuid, integer, timestamptz, timestamptz)
  to service_role;
revoke execute on function public.claim_my_donations() from public, anon;
grant execute on function public.claim_my_donations() to authenticated;

-- ---------------------------------------------------------------------------
-- Privacy policy: Stripe among the processors, and how long donor data stays.
-- Applied only while the anchor is still in the page and the new text isn't
-- (as in 20261015000010); the revision trigger keeps the previous text.
-- ---------------------------------------------------------------------------
update public.site_pages
set body_html = replace(
      body_html,
      '<li>Mailchimp — newsletter, only if you subscribe.</li>',
      '<li>Mailchimp — newsletter, only if you subscribe.</li>'
        || E'\n<li>Stripe — donations. Card details are entered only on Stripe''s page and never reach us; we receive your e-mail, the amount and the state of a monthly donation.</li>'
    )
where slug = 'privacy'
  and body_html like '%<li>Mailchimp — newsletter, only if you subscribe.</li>%'
  and body_html not like '%<li>Stripe —%';

update public.site_pages
set body_html = replace(
      body_html,
      '<li>Newsletter: until you unsubscribe; Mailchimp keeps the subscription history.</li>',
      '<li>Newsletter: until you unsubscribe; Mailchimp keeps the subscription history.</li>'
        || E'\n<li>Monthly donations without an account: your e-mail and the state of the donation while it runs; we delete them when the donation ends or move them to your membership when you sign in with that e-mail. Stripe keeps payment records as the law requires.</li>'
    )
where slug = 'privacy'
  and body_html like '%<li>Newsletter: until you unsubscribe; Mailchimp keeps the subscription history.</li>%'
  and body_html not like '%Monthly donations without an account%';
