-- =============================================================================
-- Workflow and access hardening
-- =============================================================================
--
-- Editorial workflow
-- 1. Pending entries are frozen until approved or withdrawn: guard_entries()
--    refuses changes to a `pending` entry from anyone who may not approve it,
--    and the parts of an entry (subtopics, countries, resources, FAQ, tiles,
--    tile notes) follow the same rule through can_write_entry(). The author
--    takes an entry back with the new withdraw_entry() (pending → draft).
-- 2. approve_entry(p_entry, p_expected_updated_at): with the timestamp the
--    approver saw, an entry that changed since is not approved.
-- 3. The publication date and the review note are set by the workflow
--    (approve / send back) or by someone who may approve the entry — not by
--    the author.
--
-- Accounts and roles
-- 5. Role grants with editorial reach require admin (role_needs_admin()):
--    a role that edits everyone's articles (news_scope 'all'), approves
--    articles globally (approval_scope 'global') or at all (`approvals` "e"),
--    or reaches accounts, member data or permissions (`users`, `members`,
--    `permissions`, any action). Only an admin creates, changes, removes,
--    assigns or invites to such a role. `site` stays outside the list: by the
--    owner's decision every editorial role edits site content
--    (20261013000100), and it reaches neither people's data nor the workflow.
-- 6. profiles.kind follows the role (reader ↔ the `reader` role, staff for
--    every other role), so the invitation-only and allowed-address rules run
--    whenever an account becomes staff. With "team by invitation only" on, a
--    non-admin brings an account into the team only through an invitation (an
--    empty allowed list no longer lets their direct promotion through); an
--    admin still promotes directly, invitations keep working, and a filled-in
--    allowed list now applies to invitations too.
-- 7. Column privileges on profiles: the app updates only name, phone, role,
--    status, block note and global approval; e-mail, kind and timestamps are
--    set by the database.
-- 8. staff_name() resolves team members only.
-- 9. An invitation doesn't override a blocked account or a team member with
--    another role; open invitations are revoked when an account is blocked or
--    its role changes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- A role only an admin creates, changes, assigns or invites to (see 5. above).
create or replace function public.role_needs_admin(p_role text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from roles r
                  where r.id = p_role
                    and (r.locked or r.news_scope = 'all' or r.approval_scope = 'global'))
      or exists (select 1 from role_permissions rp
                  where rp.role_id = p_role
                    and (rp.section in ('users', 'members', 'permissions')
                         or (rp.section = 'approvals' and strpos(rp.actions, 'e') > 0)));
$$;

revoke execute on function public.role_needs_admin(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1.–3. Entries
-- ---------------------------------------------------------------------------

-- Parts of an entry: a draft or planned topic by its editors, a pending or
-- published entry only by who may approve it.
create or replace function public.can_write_entry(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from entries e
                  where e.id = p_entry and can_edit_entry(e.owner_id)
                    and (e.status in ('draft', 'planned') or can_approve_entry(e.id)))
$$;

-- Stays SECURITY INVOKER on purpose: `approving` tells the workflow functions
-- (security definer, current_user = their owner) from a direct write.
create or replace function public.guard_entries()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  approving boolean := current_user not in ('authenticated', 'anon');
begin
  new.updated_at := now();
  if auth.uid() is null then
    return new;  -- import and service key
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('published', 'pending') and not approving then
      raise exception 'A new entry starts as a draft; it goes out through approval.' using errcode = '42501';
    end if;
    if new.owner_id is distinct from auth.uid() and not is_admin() then
      raise exception 'New entries belong to whoever writes them.' using errcode = '42501';
    end if;
    if (new.published_on is not null or new.review_note is not null) and not approving and not is_admin() then
      raise exception 'The publication date and the review note are set by the approval.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and not approving
     and not (old.status in ('draft', 'planned') and new.status in ('draft', 'planned')) then
    raise exception 'The status changes through submit, approve, send back or take down.' using errcode = '42501';
  end if;
  if old.status = 'published' and not approving and not can_approve_entry(old.id) then
    raise exception 'A published entry is changed by someone who may also approve it.' using errcode = '42501';
  end if;
  if old.status = 'pending' and not approving and not can_approve_entry(old.id) then
    raise exception 'This article is waiting for approval and can''t be changed. Withdraw it from review to edit it.' using errcode = '42501';
  end if;
  if new.owner_id is distinct from old.owner_id and not is_admin() then
    raise exception 'Only an admin can hand an entry to another author.' using errcode = '42501';
  end if;
  if (new.approved_by, new.approved_at) is distinct from (old.approved_by, old.approved_at) and not approving then
    raise exception 'Approval is recorded by the approval itself.' using errcode = '42501';
  end if;
  if (new.published_on, new.review_note) is distinct from (old.published_on, old.review_note)
     and not approving and not can_approve_entry(old.id) then
    raise exception 'The publication date and the review note are set by the approval.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The author (or another editor of the entry) takes a pending entry back.
create or replace function public.withdraw_entry(p_entry uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update entries set status = 'draft'
  where id = p_entry and status = 'pending' and can_edit_entry(owner_id);
  if not found then
    raise exception 'Only a pending article you may edit can be withdrawn from review.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.withdraw_entry(uuid) from public, anon;
grant execute on function public.withdraw_entry(uuid) to authenticated;

-- Approves the entry as the approver saw it (p_expected_updated_at), if given.
drop function public.approve_entry(uuid);
create function public.approve_entry(p_entry uuid, p_expected_updated_at timestamptz default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not can_approve_entry(p_entry) then
    raise exception 'This entry is outside what you may approve.' using errcode = '42501';
  end if;
  update entries
     set status = 'published',
         approved_by = auth.uid(),
         approved_at = now(),
         published_on = coalesce(published_on, current_date),
         review_note = null
   where id = p_entry and status = 'pending'
     and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
  if not found then
    if p_expected_updated_at is not null
       and exists (select 1 from entries where id = p_entry and status = 'pending') then
      raise exception 'The article changed after you opened it. Reload it and review the changes before approving.' using errcode = '22023';
    end if;
    raise exception 'Only an entry waiting for approval can be approved.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.approve_entry(uuid, timestamptz) from public, anon;
grant execute on function public.approve_entry(uuid, timestamptz) to authenticated;

-- Parts policies: one rule, can_write_entry() (row argument → called bare).
drop policy entry_chapters_add on public.entry_chapters;
drop policy entry_chapters_change on public.entry_chapters;
drop policy entry_chapters_remove on public.entry_chapters;
create policy entry_chapters_add on public.entry_chapters for insert to authenticated
  with check (public.can_write_entry(entry_id));
create policy entry_chapters_change on public.entry_chapters for update to authenticated
  using (public.can_write_entry(entry_id)) with check (public.can_write_entry(entry_id));
create policy entry_chapters_remove on public.entry_chapters for delete to authenticated
  using (public.can_write_entry(entry_id));

drop policy entry_countries_add on public.entry_countries;
drop policy entry_countries_remove on public.entry_countries;
create policy entry_countries_add on public.entry_countries for insert to authenticated
  with check (public.can_write_entry(entry_id));
create policy entry_countries_remove on public.entry_countries for delete to authenticated
  using (public.can_write_entry(entry_id));

drop policy resources_add on public.resources;
drop policy resources_change on public.resources;
drop policy resources_remove on public.resources;
create policy resources_add on public.resources for insert to authenticated
  with check (case when entry_id is null
                   then (select public.has_perm('news', 'e')) and (select public.can_edit_entry(null))
                   else public.can_write_entry(entry_id) end);
create policy resources_change on public.resources for update to authenticated
  using (case when entry_id is null
              then (select public.has_perm('news', 'e')) and (select public.can_edit_entry(null))
              else public.can_write_entry(entry_id) end)
  with check (case when entry_id is null
                   then (select public.has_perm('news', 'e')) and (select public.can_edit_entry(null))
                   else public.can_write_entry(entry_id) end);
create policy resources_remove on public.resources for delete to authenticated
  using (case when entry_id is null
              then (select public.has_perm('news', 'd')) and (select public.can_edit_entry(null))
              else public.can_write_entry(entry_id) end);

-- ---------------------------------------------------------------------------
-- 5. Roles with editorial reach are the admin's
-- ---------------------------------------------------------------------------

create or replace function public.guard_roles()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.locked then
      raise exception 'The admin role cannot be removed.' using errcode = '42501';
    end if;
    if exists (select 1 from profiles where role_id = old.id and deleted_at is null) then
      raise exception 'Accounts still hold this role. Move them to another role first.' using errcode = '23503';
    end if;
    if not is_admin() and role_needs_admin(old.id) then
      raise exception 'Only an admin can create, change or remove a role that edits or approves everyone''s articles or manages accounts, members or permissions.' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' and new.locked then
    raise exception 'Only the built-in admin role is locked.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.locked is distinct from old.locked or new.id is distinct from old.id) then
    raise exception 'A role cannot be locked, unlocked or renamed at the id level.' using errcode = '42501';
  end if;
  if not is_admin()
     and (new.news_scope = 'all' or new.approval_scope = 'global'
          or (tg_op = 'UPDATE' and new is distinct from old and role_needs_admin(old.id))) then
    raise exception 'Only an admin can create, change or remove a role that edits or approves everyone''s articles or manages accounts, members or permissions.' using errcode = '42501';
  end if;
  return new;
end;
$$;

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
  -- Whoever manages permissions doesn't add rights to their own role.
  if not is_admin() and target = (select role_id from profiles where id = auth.uid()) then
    raise exception 'You cannot change the permissions of your own role.' using errcode = '42501';
  end if;
  if not is_admin() then
    if role_needs_admin(target) then
      raise exception 'Only an admin can change the permissions of a role that edits or approves everyone''s articles or manages accounts, members or permissions.' using errcode = '42501';
    end if;
    if tg_op in ('INSERT', 'UPDATE')
       and (new.section in ('users', 'members', 'permissions')
            or (new.section = 'approvals' and strpos(new.actions, 'e') > 0)) then
      raise exception 'Only an admin can let a role approve articles or manage accounts, members or permissions.' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5.–7. Profiles
-- ---------------------------------------------------------------------------

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
  -- The kind of account follows its role, whoever writes the row.
  new.kind := case when new.role_id = 'reader' then 'reader' else 'staff' end;

  if me is null
     or exists (select 1 from internal_profile_grants g where g.tx = txid_current() and g.user_id = new.id) then
    return new;  -- service key (sign-up, imports, webhooks) or an accepted invitation
  end if;

  may_users := has_perm('users', 'e');
  may_members := has_perm('members', 'e');

  if tg_op = 'INSERT' then
    if not has_perm('users', 'c') then
      raise exception 'Your role cannot add accounts.' using errcode = '42501';
    end if;
  else
    -- Without account management: one's own name and phone; a membership
    -- manager blocks or unblocks other accounts.
    if not may_users then
      if me = old.id then
        if (new.email, new.role_id, new.kind, new.status, new.blocked_note, new.approval_global,
            new.created_at, new.last_seen_at, new.deleted_at)
           is distinct from
           (old.email, old.role_id, old.kind, old.status, old.blocked_note, old.approval_global,
            old.created_at, old.last_seen_at, old.deleted_at) then
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
  if role_changed and not is_admin() and role_needs_admin(new.role_id) then
    raise exception 'Only an admin can give a role that edits or approves everyone''s articles or manages accounts, members or permissions.' using errcode = '42501';
  end if;

  -- Team by invitation only: a non-admin brings an account into the team
  -- through an invitation (accepted above, through internal_profile_grants),
  -- not by a direct change; an admin may still promote directly.
  select * into settings from security_settings where id = 1;
  if coalesce(settings.invite_only, true) and became_staff then
    if not exists (select 1 from allowed_emails) then
      if not is_admin() then
        raise exception 'Team accounts join by invitation while the team is invitation-only.' using errcode = '42501';
      end if;
    elsif not exists (
         select 1 from allowed_emails a
         where a.value = lower(new.email)
            or (left(a.value, 1) = '@' and lower(new.email) like '%' || a.value)) then
      raise exception 'This address is not on the allowed e-mails list.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Existing rows: the kind of account follows the role.
update public.profiles
   set kind = case when role_id = 'reader' then 'reader' else 'staff' end
 where kind is distinct from case when role_id = 'reader' then 'reader' else 'staff' end;

-- The app updates only these columns; e-mail (synced from Auth), kind (from
-- the role) and the timestamps are written by the database.
revoke update on public.profiles from authenticated;
grant update (name, phone, role_id, status, blocked_note, approval_global)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 5.–6. Invitations
-- ---------------------------------------------------------------------------

create or replace function public.guard_invitations()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  target roles;
  settings security_settings;
begin
  if auth.uid() is null then
    return new;  -- service key (scripts)
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from internal_profile_grants g where g.tx = txid_current() and g.user_id = new.accepted_by) then
    return new;  -- accepted in accept_invitation_for()
  end if;

  if tg_op = 'INSERT' then
    select * into target from roles where id = new.role_id;
    if target.id = 'reader' then
      raise exception 'Readers register on their own; invitations are for the team.' using errcode = '22023';
    end if;
    if target.locked and not is_admin() then
      raise exception 'Only an admin can invite an admin.' using errcode = '42501';
    end if;
    if not is_admin() and role_needs_admin(new.role_id) then
      raise exception 'Only an admin can invite someone to a role that edits or approves everyone''s articles or manages accounts, members or permissions.' using errcode = '42501';
    end if;
    if new.approval_global and not is_admin() then
      raise exception 'Only an admin can make an approver global.' using errcode = '42501';
    end if;
    if exists (select 1 from profiles p where lower(p.email) = new.email and p.kind = 'staff' and p.deleted_at is null) then
      raise exception 'This person is already on the team.' using errcode = '23505';
    end if;
    -- A filled-in allowed list limits whom the team invites.
    select * into settings from security_settings where id = 1;
    if coalesce(settings.invite_only, true)
       and exists (select 1 from allowed_emails)
       and not exists (
         select 1 from allowed_emails a
         where a.value = new.email
            or (left(a.value, 1) = '@' and new.email like '%' || a.value)) then
      raise exception 'This address is not on the allowed e-mails list.' using errcode = '42501';
    end if;
    new.invited_by := auth.uid();
    new.accepted_at := null;
    new.accepted_by := null;
    new.revoked_at := null;
    return new;
  end if;

  -- UPDATE from the app: only revoking or extending a live invitation.
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
    if not is_admin() and role_needs_admin(old.role_id) then
      raise exception 'Only an admin can extend this invitation.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 9. A stale invitation neither un-blocks an account nor overrides a newer role.
create or replace function public.accept_invitation_for(p_user uuid)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  confirmed_email text;
  invite invitations;
  account profiles;
begin
  select lower(u.email) into confirmed_email
  from auth.users u
  where u.id = p_user and u.email_confirmed_at is not null;
  if confirmed_email is null then
    return null;
  end if;

  select * into account from profiles where id = p_user;
  if not found or account.status = 'blocked' or account.deleted_at is not null then
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
  if account.kind = 'staff' and account.role_id is distinct from invite.role_id then
    return null;
  end if;

  -- Profile changes bypass the client rules: an invitation issued by someone
  -- entitled to it (checked when it was created) makes them.
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

create or replace function public.revoke_stale_invitations()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- The invitation being accepted right now (accept_invitation_for) stays.
  if exists (select 1 from internal_profile_grants g where g.tx = txid_current() and g.user_id = new.id) then
    return null;
  end if;
  update invitations set revoked_at = now()
   where email = lower(new.email) and accepted_at is null and revoked_at is null;
  return null;
end;
$$;

revoke execute on function public.revoke_stale_invitations() from public, anon, authenticated;

create trigger profiles_revoke_invitations
  after update on public.profiles
  for each row
  when (old.role_id is distinct from new.role_id
     or (new.status = 'blocked' and old.status is distinct from 'blocked')
     or (new.deleted_at is not null and old.deleted_at is null))
  execute function public.revoke_stale_invitations();

-- ---------------------------------------------------------------------------
-- 8. Staff names only for team members
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
              from profiles p where p.id = p_profile and p.kind = 'staff')
         end
$$;
