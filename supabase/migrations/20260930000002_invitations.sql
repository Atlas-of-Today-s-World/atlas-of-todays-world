-- =============================================================================
-- Pozvánky do týmu (ARCHITEKTURA 7.3, PLAN B3)
-- =============================================================================
--
-- Čtenáři se registrují sami (role reader). Do redakce se vstupuje jen na
-- pozvánku, která rovnou určuje roli a schvalování. Oprávnění je vázané na
-- OVĚŘENÝ e-mail: kdo se přihlásí (Google, e-mailový kód) ověřenou adresou
-- z pozvánky, dostane její roli. Odkaz na pozvánku proto nenese žádné tajemství.
--
-- Stejná pravidla jako u změny role: admina zve jen admin, roli se správou
-- účtů nebo oprávnění také jen admin.
-- =============================================================================

create table public.invitations (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null check (
                        email = lower(email) and email ~ '^[^@[:space:]]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  role_id             text not null references public.roles (id),
  approval_global     boolean not null default false,
  approver_countries  text[] not null default '{}'
                        check (array_length(approver_countries, 1) is null or array_length(approver_countries, 1) <= 300),
  approver_authors    uuid[] not null default '{}',
  note                text not null default '' check (length(note) <= 300),
  invited_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '5 days',
  accepted_at         timestamptz,
  accepted_by         uuid references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  check (expires_at > created_at)
);

-- Jedna živá pozvánka na adresu.
create unique index invitations_open_email on public.invitations (email)
  where accepted_at is null and revoked_at is null;
create index invitations_role on public.invitations (role_id);
create index invitations_invited_by on public.invitations (invited_by);
create index invitations_accepted_by on public.invitations (accepted_by);

comment on table public.invitations is
  'Pozvánky do redakce. Přijímá je claim_invitation() pro ověřený e-mail.';

-- Kdo smí koho pozvat — stejná pravidla jako přidělení role v guard_profiles.
create or replace function public.guard_invitations()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  target roles;
begin
  if auth.uid() is null then
    return new;  -- servisní klíč (skripty)
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from internal_profile_grants g where g.tx = txid_current() and g.user_id = new.accepted_by) then
    return new;  -- přijetí pozvánky v accept_invitation_for()
  end if;

  if tg_op = 'INSERT' then
    select * into target from roles where id = new.role_id;
    if target.id = 'reader' then
      raise exception 'Readers register on their own; invitations are for the team.' using errcode = '22023';
    end if;
    if target.locked and not is_admin() then
      raise exception 'Only an admin can invite an admin.' using errcode = '42501';
    end if;
    if not is_admin() and exists (
      select 1 from role_permissions rp
      where rp.role_id = new.role_id and rp.section in ('users', 'permissions')) then
      raise exception 'Only an admin can invite someone who manages accounts or permissions.' using errcode = '42501';
    end if;
    if new.approval_global and not is_admin() then
      raise exception 'Only an admin can make an approver global.' using errcode = '42501';
    end if;
    if exists (select 1 from profiles p where lower(p.email) = new.email and p.kind = 'staff' and p.deleted_at is null) then
      raise exception 'This person is already on the team.' using errcode = '23505';
    end if;
    new.invited_by := auth.uid();
    new.accepted_at := null;
    new.accepted_by := null;
    new.revoked_at := null;
    return new;
  end if;

  -- UPDATE z aplikace: jen odvolání nebo prodloužení živé pozvánky.
  if old.accepted_at is not null then
    raise exception 'An accepted invitation cannot be changed.' using errcode = '42501';
  end if;
  if (new.email, new.role_id, new.approval_global, new.approver_countries, new.approver_authors,
      new.invited_by, new.created_at, new.accepted_at, new.accepted_by)
     is distinct from
     (old.email, old.role_id, old.approval_global, old.approver_countries, old.approver_authors,
      old.invited_by, old.created_at, old.accepted_at, old.accepted_by) then
    raise exception 'Revoke the invitation and send a new one instead.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_invitations() from public, anon, authenticated;

create trigger invitations_guard
  before insert or update on public.invitations
  for each row execute function public.guard_invitations();

create trigger invitations_audit
  after insert or update or delete on public.invitations
  for each row execute function public.audit_row('id');

-- ---------------------------------------------------------------------------
-- Přijetí pozvánky
-- ---------------------------------------------------------------------------
-- Vezme ověřený e-mail uživatele z auth.users, najde živou pozvánku a nastaví
-- profil. Vrací id role, nebo null, když žádná pozvánka není.

create or replace function public.accept_invitation_for(p_user uuid)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  confirmed_email text;
  invite invitations;
begin
  select lower(u.email) into confirmed_email
  from auth.users u
  where u.id = p_user and u.email_confirmed_at is not null;
  if confirmed_email is null then
    return null;
  end if;

  select * into invite
  from invitations i
  where i.email = confirmed_email
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  order by i.created_at desc
  limit 1
  for update;
  if not found then
    return null;
  end if;

  -- Změny profilu jdou mimo pravidla pro klienta: provádí je pozvánka,
  -- kterou vystavil oprávněný člověk (ověřeno při jejím založení).
  insert into internal_profile_grants (user_id) values (p_user) on conflict do nothing;
  update profiles
     set kind = 'staff', role_id = invite.role_id, approval_global = invite.approval_global,
         status = 'active'
   where id = p_user;
  insert into approver_countries (user_id, country_iso3)
    select p_user, c from unnest(invite.approver_countries) c
    where exists (select 1 from countries where iso3 = c)
  on conflict do nothing;
  insert into approver_authors (user_id, author_id)
    select p_user, a from unnest(invite.approver_authors) a
    where a <> p_user and exists (select 1 from profiles where id = a)
  on conflict do nothing;
  update invitations set accepted_at = now(), accepted_by = p_user where id = invite.id;
  delete from internal_profile_grants where tx = txid_current() and user_id = p_user;

  return invite.role_id;
end;
$$;
revoke execute on function public.accept_invitation_for(uuid) from public, anon, authenticated;

-- Pro přihlášeného: volá /auth/callback po každém přihlášení.
create or replace function public.claim_invitation()
returns text
language sql security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then null else accept_invitation_for(auth.uid()) end;
$$;
revoke execute on function public.claim_invitation() from public, anon;
grant execute on function public.claim_invitation() to authenticated;

-- Nový účet: profil čtenáře, a pokud čeká pozvánka na ověřený e-mail, rovnou ji přijme.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles (id, email, name, role_id, kind, status)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'reader', 'reader', 'active');
  perform accept_invitation_for(new.id);
  return new;
end;
$$;

-- E-mail ověřený až po registraci (e-mailový kód): přijmout pozvánku teď.
-- Při změně e-mailu v Auth se srovná i profil.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update profiles set email = lower(new.email) where id = new.id;
  end if;
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform accept_invitation_for(new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;

create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.invitations enable row level security;

create policy invitations_read on public.invitations for select to authenticated
  using (has_perm('users', 'v'));
create policy invitations_add on public.invitations for insert to authenticated
  with check (has_perm('users', 'c'));
create policy invitations_change on public.invitations for update to authenticated
  using (has_perm('users', 'e')) with check (has_perm('users', 'e'));
create policy invitations_remove on public.invitations for delete to authenticated
  using (has_perm('users', 'd') and accepted_at is null);

grant select, insert, update, delete on public.invitations to authenticated;
