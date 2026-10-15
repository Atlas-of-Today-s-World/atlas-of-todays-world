-- =============================================================================
-- GDPR retention: what an account deletion removes, what the export shows,
-- and personal text left in old audit snapshots (owner decisions, 2026-10-15)
-- =============================================================================
--
-- Builds on 20261013000350. Still nothing is deleted on a schedule and no
-- retention period changes (the audit log keeps its 12 months).
--
-- 1. delete_my_personal_data() also removes ACCEPTED invitations to the
--    caller's verified e-mail (and any invitation the account accepted):
--    once accepted they are history only. Their audit rows stay (ids only).
-- 2. It also removes the caller's exact address from allowed_emails, unless
--    (a) a live invitation to that address still needs it or (b) it is the
--    last row: an empty list switches the allow-list off (guard_invitations
--    then lets the team invite any address), so the last row stays. Domain
--    rows ('@example.org') are never touched. The audit rows of that address
--    (target = the address, snapshot = address and note) lose the address.
--    Re-inviting the person later needs the address back on the list first
--    whenever the list is in use — exactly as for anyone new.
-- 3. my_personal_data() adds: invitations.note (a note about the person),
--    invitations the account accepted, the caller's own audit actions
--    (action, table, target id, time, names of the changed columns — never a
--    value, never a snapshot; a target that is an e-mail address is left
--    out) and the site page revisions they saved (id, slug, time — no page
--    content). profiles.blocked_note is read by the export under RLS (own
--    row). Keys are only added.
-- 4. The invitations audit trigger keeps `note` out of the log from now on
--    (like volunteer application text since 20261013000350), so deleting an
--    invitation no longer copies its note into audit_log.
-- 5. One-time scrub: volunteer application text (name, topics, message) and
--    invitation notes are removed from EXISTING audit snapshots. The rows,
--    ids, actions, actors and timestamps stay. Idempotent: a second run
--    matches no row.
--
-- Default privileges are revoked (20261013000210): every grant is explicit.
-- Tests: supabase/tests/gdpr-retention.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: an audit `detail` without the given keys (top level, old, new)
-- ---------------------------------------------------------------------------
create or replace function public.audit_detail_without(p_detail jsonb, p_keys text[])
returns jsonb
language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when jsonb_typeof(p_detail) <> 'object' then p_detail
    else (p_detail - p_keys)
      || case when jsonb_typeof(p_detail -> 'old') = 'object'
              then jsonb_build_object('old', (p_detail -> 'old') - p_keys) else '{}'::jsonb end
      || case when jsonb_typeof(p_detail -> 'new') = 'object'
              then jsonb_build_object('new', (p_detail -> 'new') - p_keys) else '{}'::jsonb end
  end;
$$;
-- Called only by the migration and the definer RPC below.
revoke execute on function public.audit_detail_without(jsonb, text[]) from public, anon, authenticated;

-- Does the snapshot hold any of the keys (top level, old or new)?
create or replace function public.audit_detail_has(p_detail jsonb, p_keys text[])
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select jsonb_typeof(p_detail) = 'object'
     and (p_detail ?| p_keys
          or (jsonb_typeof(p_detail -> 'old') = 'object' and (p_detail -> 'old') ?| p_keys)
          or (jsonb_typeof(p_detail -> 'new') = 'object' and (p_detail -> 'new') ?| p_keys));
$$;
revoke execute on function public.audit_detail_has(jsonb, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Invitation notes stay out of the audit log
-- ---------------------------------------------------------------------------
drop trigger invitations_audit on public.invitations;
create trigger invitations_audit
  after insert or update or delete on public.invitations
  for each row execute function public.audit_row('id', 'note');

-- ---------------------------------------------------------------------------
-- 5. One-time scrub of existing snapshots (idempotent)
-- ---------------------------------------------------------------------------
update public.audit_log a
   set detail = public.audit_detail_without(a.detail, array['name', 'topics', 'message'])
 where split_part(a.action, '.', 1) = 'volunteer_applications'
   and public.audit_detail_has(a.detail, array['name', 'topics', 'message']);

update public.audit_log a
   set detail = public.audit_detail_without(a.detail, array['note'])
 where split_part(a.action, '.', 1) = 'invitations'
   and public.audit_detail_has(a.detail, array['note']);

-- ---------------------------------------------------------------------------
-- 3. The export
-- ---------------------------------------------------------------------------
create or replace function public.my_personal_data()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  my_email text := public.my_confirmed_email();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'authorProfile', (
      select jsonb_build_object('id', a.id, 'slug', a.slug, 'name', a.name,
        'photoUrl', a.photo_url, 'bio', a.bio, 'positionality', a.positionality,
        'createdAt', a.created_at)
      from authors a where a.profile_id = me
      order by a.created_at limit 1),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'roleId', i.role_id,
        'approvalGlobal', i.approval_global, 'approverCountries', i.approver_countries,
        'approverAuthors', i.approver_authors, 'note', i.note, 'createdAt', i.created_at,
        'expiresAt', i.expires_at, 'acceptedAt', i.accepted_at, 'revokedAt', i.revoked_at)
        order by i.created_at, i.id)
      from invitations i
      where (my_email is not null and i.email = my_email) or i.accepted_by = me), '[]'::jsonb),
    'volunteerApplications', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'email', v.email,
        'topics', v.topics, 'message', v.message, 'status', v.status,
        'createdAt', v.created_at, 'updatedAt', v.updated_at)
        order by v.created_at)
      from volunteer_applications v
      where my_email is not null and lower(v.email) = my_email), '[]'::jsonb),
    'entryRevisions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'entryId', r.entry_id,
        'savedAt', r.saved_at, 'published', r.published)
        order by r.saved_at, r.id)
      from entry_revisions r where r.saved_by = me), '[]'::jsonb),
    'sitePageRevisions', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'slug', r.page_slug, 'savedAt', r.saved_at)
        order by r.saved_at, r.id)
      from site_page_revisions r where r.saved_by = me), '[]'::jsonb),
    -- What the caller did, not what the rows held: column names only.
    'auditActions', coalesce((
      select jsonb_agg(jsonb_build_object(
          'action', l.action,
          'table', split_part(l.action, '.', 1),
          'targetId', case when strpos(coalesce(l.target, ''), '@') > 0 then null else l.target end,
          'at', l.at,
          'columns', (
            select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
            from (
              select jsonb_object_keys(case when jsonb_typeof(l.detail -> 'old') = 'object'
                                            then l.detail -> 'old' else '{}'::jsonb end)
              union
              select jsonb_object_keys(case when jsonb_typeof(l.detail -> 'new') = 'object'
                                            then l.detail -> 'new' else '{}'::jsonb end)
              union
              select jsonb_array_elements_text(case when jsonb_typeof(l.detail -> 'changed') = 'array'
                                                    then l.detail -> 'changed' else '[]'::jsonb end)
            ) as c(name)))
        order by l.at, l.id)
      from audit_log l where l.actor = me), '[]'::jsonb));
end;
$$;
revoke execute on function public.my_personal_data() from public, anon;
grant execute on function public.my_personal_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 1.–2. The account deletion
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_personal_data()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  my_email text := public.my_confirmed_email();
  invitations_removed integer := 0;
  applications_removed integer := 0;
  allowed_removed integer := 0;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not public.mfa_ok() then
    raise exception 'Your role requires the second sign-in factor.' using errcode = '42501';
  end if;
  -- Same rule as keep_one_admin(): fail before anything is removed.
  if exists (select 1 from profiles p join roles r on r.id = p.role_id
             where p.id = me and r.locked and p.status = 'active' and p.deleted_at is null)
     and not exists (select 1 from profiles p join roles r on r.id = p.role_id
                     where p.id <> me and r.locked and p.status = 'active'
                       and p.deleted_at is null) then
    raise exception 'At least one active admin has to remain.' using errcode = '42501';
  end if;

  -- Every invitation to the verified address (pending, revoked, expired and
  -- accepted — the accepted ones are history only) and any the account
  -- accepted. The audit trigger logs each deletion by id, without the note.
  with gone as (
    delete from invitations i
    where (my_email is not null and i.email = my_email) or i.accepted_by = me
    returning 1)
  select count(*)::integer into invitations_removed from gone;

  if my_email is not null then
    with gone as (
      delete from volunteer_applications v where lower(v.email) = my_email returning 1)
    select count(*)::integer into applications_removed from gone;

    -- The exact address on the allowed list, unless a live invitation still
    -- needs it or it is the last row (an empty list turns the allow-list off).
    if not exists (select 1 from invitations i
                   where i.email = my_email and i.accepted_at is null and i.revoked_at is null)
       and exists (select 1 from allowed_emails a where a.value <> my_email) then
      with gone as (delete from allowed_emails a where a.value = my_email returning 1)
      select count(*)::integer into allowed_removed from gone;
      if allowed_removed > 0 then
        -- Its audit rows (this deletion included) keep the action, not the address.
        update audit_log l
           set target = null,
               detail = public.audit_detail_without(l.detail, array['value', 'note'])
         where split_part(l.action, '.', 1) = 'allowed_emails' and l.target = my_email;
      end if;
    end if;
  end if;

  -- Rows written before DB-14 carried the actor's e-mail; the id stays.
  update audit_log set actor_email = null where actor = me and actor_email is not null;

  return jsonb_build_object('invitations', invitations_removed,
                            'volunteerApplications', applications_removed,
                            'allowedEmails', allowed_removed);
end;
$$;
revoke execute on function public.delete_my_personal_data() from public, anon;
grant execute on function public.delete_my_personal_data() to authenticated;
