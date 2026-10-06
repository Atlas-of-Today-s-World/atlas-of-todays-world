-- Volunteer content editors: visitors apply on /membership; people who manage
-- accounts (section "users") read the applications in the admin and set the
-- address they should be e-mailed to (sending comes later).

-- ---------------------------------------------------------------------------
-- Where new applications are sent (one row).
-- ---------------------------------------------------------------------------
create table public.volunteer_settings (
  id           integer primary key default 1 check (id = 1),
  notify_email text check (
    notify_email is null
    or (char_length(notify_email) <= 254 and notify_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  updated_at   timestamptz not null default now()
);
insert into public.volunteer_settings default values;

create trigger volunteer_settings_stamp
  before update on public.volunteer_settings
  for each row execute function public.stamp_row();

create trigger volunteer_settings_audit
  after update on public.volunteer_settings
  for each row execute function public.audit_row('id');

-- ---------------------------------------------------------------------------
-- The applications.
-- ---------------------------------------------------------------------------
create table public.volunteer_applications (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  email       text not null check (
    char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  topics      text not null default '' check (char_length(topics) <= 300),
  message     text not null default '' check (char_length(message) <= 2000),
  status      text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  -- Set once the e-mail to notify_email has gone out (sending comes later).
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index volunteer_applications_created on public.volunteer_applications (created_at desc);

create trigger volunteer_applications_stamp
  before update on public.volunteer_applications
  for each row execute function public.stamp_row();

create trigger volunteer_applications_audit
  after update or delete on public.volunteer_applications
  for each row execute function public.audit_row('id');

-- ---------------------------------------------------------------------------
-- Applying: the only way in for a visitor. The server action rate-limits per
-- IP first; the function also caps applications per hour for everyone, so a
-- direct call with the public key can't flood the table.
-- ---------------------------------------------------------------------------
create or replace function public.submit_volunteer_application(
  p_name text,
  p_email text,
  p_topics text,
  p_message text
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if (
    select count(*) from volunteer_applications where created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into volunteer_applications (name, email, topics, message)
  values (btrim(p_name), lower(btrim(p_email)), btrim(coalesce(p_topics, '')),
          btrim(coalesce(p_message, '')));
end;
$$;

revoke execute on function public.submit_volunteer_application(text, text, text, text)
  from public;
grant execute on function public.submit_volunteer_application(text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Access: account managers only (personal data — never anon).
-- ---------------------------------------------------------------------------
alter table public.volunteer_settings enable row level security;
alter table public.volunteer_applications enable row level security;

create policy volunteer_settings_read on public.volunteer_settings for select to authenticated
  using (has_perm('users', 'v'));
create policy volunteer_settings_change on public.volunteer_settings for update to authenticated
  using (has_perm('users', 'e')) with check (has_perm('users', 'e'));

create policy volunteer_applications_read on public.volunteer_applications
  for select to authenticated using (has_perm('users', 'v'));
create policy volunteer_applications_change on public.volunteer_applications
  for update to authenticated using (has_perm('users', 'e')) with check (has_perm('users', 'e'));
create policy volunteer_applications_delete on public.volunteer_applications
  for delete to authenticated using (has_perm('users', 'd'));

revoke all on public.volunteer_settings, public.volunteer_applications from anon, authenticated;
grant select on public.volunteer_settings, public.volunteer_applications to authenticated;
grant update (notify_email) on public.volunteer_settings to authenticated;
grant update (status) on public.volunteer_applications to authenticated;
grant delete on public.volunteer_applications to authenticated;
