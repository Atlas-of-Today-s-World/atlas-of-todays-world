-- =============================================================================
-- Změna role účtu: stejná pravidla jako pozvánka (PLAN E6)
-- =============================================================================
-- Pozvánka nedovolí ne-adminovi pozvat někoho se správou účtů nebo oprávnění
-- (guard_invitations). Změna role u existujícího účtu hlídala jen roli admin,
-- takže správce oprávnění mohl kohokoli povýšit na správce účtů. Teď platí
-- totéž pravidlo i tady.
-- =============================================================================

create or replace function public.guard_profiles()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  may_users boolean;
  may_members boolean;
  settings security_settings;
  new_role roles;
  role_changed boolean;
  became_staff boolean;
begin
  if me is null
     or exists (select 1 from internal_profile_grants g where g.tx = txid_current() and g.user_id = new.id) then
    return new;  -- servisní klíč (registrace, importy, webhooky) nebo přijetí pozvánky
  end if;

  may_users := has_perm('users', 'e');
  may_members := has_perm('members', 'e');

  if tg_op = 'INSERT' then
    if not has_perm('users', 'c') then
      raise exception 'Your role cannot add accounts.' using errcode = '42501';
    end if;
  else
    -- Kdo nemá správu účtů, smí na sobě měnit jen jméno a telefon
    -- a správce členství u cizích účtů jen stav (blokace).
    if not may_users then
      if me = old.id then
        if (new.email, new.role_id, new.kind, new.status, new.blocked_note, new.approval_global, new.deleted_at)
           is distinct from
           (old.email, old.role_id, old.kind, old.status, old.blocked_note, old.approval_global, old.deleted_at) then
          raise exception 'You can change only your own name and phone.' using errcode = '42501';
        end if;
      elsif may_members then
        if (new.email, new.name, new.phone, new.role_id, new.kind, new.approval_global, new.deleted_at)
           is distinct from
           (old.email, old.name, old.phone, old.role_id, old.kind, old.approval_global, old.deleted_at) then
          raise exception 'Membership managers can only block or unblock an account.' using errcode = '42501';
        end if;
      else
        raise exception 'Your role cannot change accounts.' using errcode = '42501';
      end if;
    end if;

    if me = old.id and not is_admin()
       and (new.role_id is distinct from old.role_id or new.status is distinct from old.status) then
      raise exception 'You cannot change your own role or status.' using errcode = '42501';
    end if;

    if new.approval_global is distinct from old.approval_global and not is_admin() then
      raise exception 'Only an admin can make an approver global.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' then
    role_changed := true;
    became_staff := new.kind = 'staff';
  else
    role_changed := new.role_id is distinct from old.role_id;
    became_staff := new.kind = 'staff' and old.kind is distinct from 'staff';
  end if;

  select * into new_role from roles where id = new.role_id;
  if new_role.locked and role_changed and not is_admin() then
    raise exception 'Only an admin can give the admin role.' using errcode = '42501';
  end if;
  -- Stejné pravidlo jako u pozvánek: roli se správou účtů či oprávnění dává jen admin.
  if role_changed and not is_admin() and exists (
       select 1 from role_permissions rp
       where rp.role_id = new.role_id and rp.section in ('users', 'permissions')) then
    raise exception 'Only an admin can give a role that manages accounts or permissions.' using errcode = '42501';
  end if;

  select * into settings from security_settings where id = 1;
  if coalesce(settings.invite_only, true) and became_staff
     and exists (select 1 from allowed_emails)
     and not exists (
       select 1 from allowed_emails a
       where a.value = lower(new.email)
          or (left(a.value, 1) = '@' and lower(new.email) like '%' || a.value)) then
    raise exception 'This address is not on the allowed e-mails list.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profiles() from public, anon, authenticated;

-- Totéž u matice oprávnění: přidat roli správu účtů nebo oprávnění smí jen admin,
-- jinak by správce oprávnění nepřímo vyráběl další správce.
create or replace function public.guard_role_permissions()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  target text := coalesce(new.role_id, old.role_id);
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if exists (select 1 from roles where id = target and locked) then
    raise exception 'The admin role always has everything; its permissions are not stored.' using errcode = '42501';
  end if;
  -- Kdo spravuje oprávnění, nesmí je přidávat vlastní roli — jinak by si
  -- „permission admin" jedním kliknutím vzal i obsah, který mu role zakazuje.
  if not is_admin() and target = (select role_id from profiles where id = auth.uid()) then
    raise exception 'You cannot change the permissions of your own role.' using errcode = '42501';
  end if;
  if not is_admin() and tg_op in ('INSERT', 'UPDATE') and new.section in ('users', 'permissions')
     and (tg_op = 'INSERT' or new.actions is distinct from old.actions) then
    raise exception 'Only an admin can let a role manage accounts or permissions.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.guard_role_permissions() from public, anon, authenticated;
