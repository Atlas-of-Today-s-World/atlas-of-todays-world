-- =============================================================================
-- Atlas Patrons settings and FAQ, editable in the admin (/admin/patrons)
-- =============================================================================
--
-- 1. patron_settings — one row: the donation card's preset amounts per period,
--    the defaults, the free "Other amount" (which periods, bounds) and the
--    public goal. The checkout validates against the same row, so an amount
--    no longer offered is refused. Currency stays EUR (whole euros).
-- 2. patron_faq — the questions on /membership (and its FAQPage JSON-LD).
--    answer_html is sanitized by the app on save (lib/security/sanitize.ts) and
--    again on render (SafeHtml); `{email}` in an answer is a placeholder the
--    page fills with the contact address.
--
-- Rights: section `site` or `members` (either is enough) — view "v", change
-- "e", add "c", delete "d". Anyone reads the settings and the visible FAQ.
-- Seeded with the values the site showed until now (features/membership/config.ts,
-- messages/en.json), so nothing visible changes — except one answer's stale
-- legal name ("Online Encyklopedie Migrace, z.s." → ORGANIZATION.legalName).
-- =============================================================================

-- A list of preset amounts: 1–8 whole euros, each 1–10 000, ascending, no repeats.
create or replace function public.valid_patron_amounts(p_amounts integer[])
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select p_amounts is not null
     and array_ndims(p_amounts) = 1
     and array_lower(p_amounts, 1) = 1
     and cardinality(p_amounts) between 1 and 8
     and not exists (select 1 from unnest(p_amounts) a (v) where v is null or v < 1 or v > 10000)
     and p_amounts = (select array_agg(distinct v order by v) from unnest(p_amounts) a (v));
$$;

revoke execute on function public.valid_patron_amounts(integer[]) from public, anon;
grant execute on function public.valid_patron_amounts(integer[]) to authenticated, service_role;

create table public.patron_settings (
  id                    integer primary key default 1 check (id = 1),
  monthly_amounts       integer[] not null
    constraint patron_settings_monthly_amounts_check check (public.valid_patron_amounts(monthly_amounts)),
  one_time_amounts      integer[] not null
    constraint patron_settings_one_time_amounts_check check (public.valid_patron_amounts(one_time_amounts)),
  default_period        text not null default 'monthly'
    check (default_period in ('monthly', 'one-time')),
  default_monthly       integer not null,
  default_one_time      integer not null,
  -- Periods that also offer a free "Other amount".
  other_amount_periods  text[] not null default '{}'
    check (other_amount_periods <@ array['monthly', 'one-time']::text[]
           and array_position(other_amount_periods, null) is null),
  other_amount_min      integer not null default 1,
  other_amount_max      integer not null default 10000,
  goal_patrons          integer not null check (goal_patrons between 1 and 1000000),
  goal_monthly_eur      integer not null check (goal_monthly_eur between 1 and 10000000),
  -- Below this many patrons the page shows the goal without counts.
  goal_counts_from      integer not null default 10 check (goal_counts_from between 0 and 1000000),
  updated_at            timestamptz not null default now(),
  constraint patron_settings_default_monthly_check check (default_monthly = any (monthly_amounts)),
  constraint patron_settings_default_one_time_check check (default_one_time = any (one_time_amounts)),
  constraint patron_settings_other_amount_check
    check (other_amount_min between 1 and 10000 and other_amount_max between other_amount_min and 10000)
);

insert into public.patron_settings (
  monthly_amounts, one_time_amounts, default_period, default_monthly, default_one_time,
  other_amount_periods, other_amount_min, other_amount_max,
  goal_patrons, goal_monthly_eur, goal_counts_from)
values (
  '{5,10,15,25,50,100}', '{30,50,100}', 'monthly', 10, 50,
  '{one-time}', 1, 10000,
  1000, 10000, 10);

create trigger patron_settings_stamp
  before update on public.patron_settings
  for each row execute function public.stamp_row();

create trigger patron_settings_audit
  after update on public.patron_settings
  for each row execute function public.audit_row('id');

alter table public.patron_settings enable row level security;

create policy patron_settings_read on public.patron_settings for select to anon, authenticated
  using (true);
create policy patron_settings_change on public.patron_settings for update to authenticated
  using ((select public.has_perm('site', 'e')) or (select public.has_perm('members', 'e')))
  with check ((select public.has_perm('site', 'e')) or (select public.has_perm('members', 'e')));

-- Explicit grants (no reliance on Supabase's default privileges): every column
-- is public; only the editable ones may be updated; nobody inserts or deletes.
revoke all on public.patron_settings from anon, authenticated;
grant select (
  id, monthly_amounts, one_time_amounts, default_period, default_monthly, default_one_time,
  other_amount_periods, other_amount_min, other_amount_max,
  goal_patrons, goal_monthly_eur, goal_counts_from, updated_at)
  on public.patron_settings to anon, authenticated;
grant update (
  monthly_amounts, one_time_amounts, default_period, default_monthly, default_one_time,
  other_amount_periods, other_amount_min, other_amount_max,
  goal_patrons, goal_monthly_eur, goal_counts_from)
  on public.patron_settings to authenticated;

-- ---------------------------------------------------------------------------
-- FAQ on /membership
-- ---------------------------------------------------------------------------

create table public.patron_faq (
  id           uuid primary key default gen_random_uuid(),
  question     text not null check (char_length(btrim(question)) between 1 and 300),
  answer_html  text not null check (char_length(btrim(answer_html)) between 1 and 3000),
  sort         integer not null default 0 check (sort between 0 and 100000),
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index patron_faq_sort on public.patron_faq (sort, id);

insert into public.patron_faq (question, answer_html, sort) values
  ('Will the content be free for everyone?',
   '<p>Our primary mission is to give everyone a chance to reflect on the situation in our world. Therefore, our encyclopedia will be fully open-access to any reader all over the world. The role of the membership community is to support this mission.</p>',
   10),
  ('Are you a registered nonprofit organisation?',
   '<p>Our project grew out of the Online Encyclopedia of Migration, a non-profit, non-governmental organisation that has been registered in the Czech Republic since 2016 (we are officially called Atlas of Today''s World, z. s.). Within Czech legislation, we are not permitted to make any profit.</p>',
   20),
  ('How can I cancel or change my monthly donation?',
   '<p>You can cancel your monthly donation anytime via Stripe. The link is available below the Donate &amp; Join button, in your initial registration email, and at the bottom of each members-only newsletter. Alternatively, you can email us at {email}, and we will help you. Similarly, you can change your initial one-time donation to a monthly donation by following the same steps.</p>',
   30);

create trigger patron_faq_stamp
  before update on public.patron_faq
  for each row execute function public.stamp_row();

create trigger patron_faq_audit
  after insert or update or delete on public.patron_faq
  for each row execute function public.audit_row('question');

alter table public.patron_faq enable row level security;

create policy patron_faq_public on public.patron_faq for select to anon
  using (visible);
create policy patron_faq_read on public.patron_faq for select to authenticated
  using (visible or (select public.has_perm('site', 'v')) or (select public.has_perm('members', 'v')));
create policy patron_faq_add on public.patron_faq for insert to authenticated
  with check ((select public.has_perm('site', 'c')) or (select public.has_perm('members', 'c')));
create policy patron_faq_change on public.patron_faq for update to authenticated
  using ((select public.has_perm('site', 'e')) or (select public.has_perm('members', 'e')))
  with check ((select public.has_perm('site', 'e')) or (select public.has_perm('members', 'e')));
create policy patron_faq_remove on public.patron_faq for delete to authenticated
  using ((select public.has_perm('site', 'd')) or (select public.has_perm('members', 'd')));

-- Explicit grants (no reliance on Supabase's default privileges); RLS narrows
-- them per role. The public needs no timestamps; the team's admin list does.
revoke all on public.patron_faq from anon, authenticated;
grant select (id, question, answer_html, sort, visible) on public.patron_faq to anon;
grant select (id, question, answer_html, sort, visible, created_at, updated_at)
  on public.patron_faq to authenticated;
grant insert (question, answer_html, sort, visible) on public.patron_faq to authenticated;
grant update (question, answer_html, sort, visible) on public.patron_faq to authenticated;
grant delete on public.patron_faq to authenticated;

-- Moves one question up or down: renumbers the list (10, 20, …) with the two
-- swapped, in one transaction. Security invoker — the update policy decides;
-- without the right nothing changes and the call is refused.
create or replace function public.move_patron_faq(p_id uuid, p_up boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  ids uuid[];
  i integer;
  j integer;
  changed integer;
begin
  select array_agg(id order by sort, id) into ids from patron_faq;
  i := array_position(ids, p_id);
  if i is null then
    raise exception 'The question no longer exists.' using errcode = '22023';
  end if;
  j := case when p_up then i - 1 else i + 1 end;
  if j < 1 or j > cardinality(ids) then
    return;  -- already first / last
  end if;
  ids[i] := ids[j];
  ids[j] := p_id;
  update patron_faq f
     set sort = o.pos * 10
    from unnest(ids) with ordinality as o (id, pos)
   where f.id = o.id and f.sort is distinct from o.pos * 10;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'You can''t reorder the questions.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.move_patron_faq(uuid, boolean) from public, anon;
grant execute on function public.move_patron_faq(uuid, boolean) to authenticated;
