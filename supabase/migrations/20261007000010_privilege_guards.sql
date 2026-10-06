-- Privilege guards (security review, October 2026).
--
-- The role hierarchy and the editorial workflow were enforced when rights are
-- granted, not always when they are used against someone above you or behind
-- the workflow's back. Each block below closes one such gap in the database,
-- so it holds whatever the app or a direct API call does.
--
-- The guards are SECURITY DEFINER (they read roles and permissions whatever
-- the caller may see) and let through only calls without a user session
-- (service key, cron, migrations). The two stamping triggers in block 5 are
-- plain functions and also trust statements inside SECURITY DEFINER functions
-- (current_user is then the owner, not `authenticated`), like guard_entries().

-- ---------------------------------------------------------------------------
-- 1. An admin account is changed or removed only by an admin
-- ---------------------------------------------------------------------------
-- guard_profiles() stops non-admins from GRANTING the locked admin role but
-- not from blocking, demoting, renaming the e-mail of or deleting someone who
-- already holds it (and the app then bans a blocked account in Auth).
create or replace function public.guard_admin_targets()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or is_admin() then
    return coalesce(new, old);
  end if;
  -- One's own row is covered by guard_profiles (own role and status are frozen).
  if old.id = auth.uid() then
    return coalesce(new, old);
  end if;
  if exists (select 1 from roles r where r.id = old.role_id and r.locked)
     and (tg_op = 'DELETE'
          or (new.role_id, new.status, new.kind, new.email, new.deleted_at, new.blocked_note,
              new.approval_global)
             is distinct from
             (old.role_id, old.status, old.kind, old.email, old.deleted_at, old.blocked_note,
              old.approval_global)) then
    raise exception 'Only an admin can change or remove an admin account.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.guard_admin_targets() from public, anon, authenticated;

create trigger profiles_guard_admin_targets
  before update or delete on public.profiles
  for each row execute function public.guard_admin_targets();

-- ---------------------------------------------------------------------------
-- 2. Sign-in security (2FA roles, invite-only, impersonation) is admin-only
-- ---------------------------------------------------------------------------
-- `permissions e` may edit security_settings (session length, lockout), but
-- switching off 2FA for admins or opening registration would let a phished
-- password alone act as an admin.
create or replace function public.guard_security_settings()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not is_admin()
     and (new.require_2fa_roles, new.invite_only, new.impersonation)
         is distinct from (old.require_2fa_roles, old.invite_only, old.impersonation) then
    raise exception 'Only an admin can change sign-in security.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_security_settings() from public, anon, authenticated;

create trigger security_settings_guard
  before update on public.security_settings
  for each row execute function public.guard_security_settings();

-- ---------------------------------------------------------------------------
-- 3. Invitations: a revoked one stays revoked, an extension is short
-- ---------------------------------------------------------------------------
-- guard_invitations() freezes who and which role, but not revoked_at and
-- expires_at: a revoked or expired invitation an admin once sent for a
-- privileged role could be revived for years by an account manager.
create or replace function public.guard_invitation_lifetime()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'A revoked invitation stays revoked; send a new one.' using errcode = '42501';
  end if;
  if new.expires_at is distinct from old.expires_at then
    -- The same five days a new invitation gets (with a little slack for the clock).
    if new.expires_at > now() + interval '5 days 1 hour' then
      raise exception 'An invitation is valid for at most five days.' using errcode = '22023';
    end if;
    if not is_admin() and (
         exists (select 1 from roles r where r.id = old.role_id and r.locked)
      or exists (select 1 from role_permissions rp
                 where rp.role_id = old.role_id and rp.section in ('users', 'permissions'))) then
      raise exception 'Only an admin can extend this invitation.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_invitation_lifetime() from public, anon, authenticated;

create trigger invitations_guard_lifetime
  before update on public.invitations
  for each row execute function public.guard_invitation_lifetime();

-- ---------------------------------------------------------------------------
-- 4. A scheduled entry is published only as it was approved
-- ---------------------------------------------------------------------------
-- guard_entry_schedule() drops the plan when someone else edits the entry row,
-- but subtopics, FAQ, tile texts, resources, tiles and places live in their
-- own tables: rewriting them after scheduling would go out "approved by" the
-- scheduler. Any such change by someone else now drops the plan as well.
create or replace function public.drop_schedule_on_part_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_entry uuid := coalesce(to_jsonb(new) ->> 'entry_id', to_jsonb(old) ->> 'entry_id')::uuid;
begin
  if v_entry is not null and auth.uid() is not null then
    update entries
       set publish_at = null, scheduled_by = null
     where id = v_entry
       and publish_at is not null
       and scheduled_by is distinct from auth.uid();
  end if;
  return null;
end;
$$;
revoke execute on function public.drop_schedule_on_part_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['entry_chapters', 'entry_faq', 'entry_tile_notes', 'resources',
                           'learn_more_tiles', 'entry_countries'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.drop_schedule_on_part_change()',
      t || '_drop_schedule', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. "Approved by" and "created by" are never chosen by the client
-- ---------------------------------------------------------------------------
-- A new draft could carry approved_by = <an editor> until its real approval;
-- created_by on map data was whatever the client sent.
create or replace function public.stamp_new_entry_approval()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and current_user in ('authenticated', 'anon') then
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_new_entry_approval() from public, anon, authenticated;

create trigger entries_stamp_new_approval
  before insert on public.entries
  for each row execute function public.stamp_new_entry_approval();

-- Rows written straight by a signed-in client are stamped with that client.
-- (Subtopics are stamped by replace_entry_parts(), which keeps the original
-- author of an unchanged subtopic across saves.)
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and current_user in ('authenticated', 'anon') then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_created_by() from public, anon, authenticated;

create trigger indicators_stamp_created_by before insert on public.indicators
  for each row execute function public.stamp_created_by();
create trigger special_regions_stamp_created_by before insert on public.special_regions
  for each row execute function public.stamp_created_by();
create trigger map_areas_stamp_created_by before insert on public.map_areas
  for each row execute function public.stamp_created_by();

-- ---------------------------------------------------------------------------
-- 6. Renaming an original does not move a published translation's URL
-- ---------------------------------------------------------------------------
-- follow_original_slug() runs as its owner, so the approval guards trusted
-- it: the author of an unpublished original could change the live address of
-- someone else's published translation. Published translations now follow
-- only when the person renaming may approve them.
create or replace function public.follow_original_slug()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update entries
     set slug = new.slug
   where translation_of = new.id
     and slug <> new.slug
     and (status <> 'published' or auth.uid() is null or can_approve_entry(id));
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Staff names only for active staff
-- ---------------------------------------------------------------------------
create or replace function public.staff_name(p_profile uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case when exists (select 1 from profiles me
                           where me.id = auth.uid() and me.kind = 'staff'
                             and me.status = 'active' and me.deleted_at is null) then
           (select coalesce(nullif(btrim(p.name), ''), split_part(p.email, '@', 1))
              from profiles p where p.id = p_profile)
         end
$$;

-- ---------------------------------------------------------------------------
-- 8. Volunteer applications only through the server
-- ---------------------------------------------------------------------------
-- With the public key anyone could exhaust the shared hourly cap and block
-- real applicants. The server action (per-IP limit) calls it with the service
-- key; the hourly cap stays as a last line.
revoke execute on function public.submit_volunteer_application(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_volunteer_application(text, text, text, text)
  to service_role;
