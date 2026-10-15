-- =============================================================================
-- GDPR completeness: one's own data export and account deletion (audit S-L14)
-- =============================================================================
--
-- Nothing here deletes data on a schedule or changes how long anything is
-- kept: every removal runs only when a signed-in user deletes their own
-- account (src/features/auth/actions.ts, deleteAccount).
--
-- 1. my_personal_data() — the parts of the export (/api/account/export) that
--    RLS can't hand to their owner: invitations sent to the caller's verified
--    e-mail and volunteer applications from it (both readable only for `users`
--    "v"), the author profile linked to the account (authors.profile_id is not
--    readable for `authenticated`, 20261008000030) and the metadata of the
--    entry revisions the caller saved (entry_revisions is readable only while
--    the caller may edit that entry). Definer, scoped to auth.uid() and the
--    caller's own confirmed e-mail; revisions without their snapshot (other
--    people's text). Internal fields (invitations.note / invited_by) stay out,
--    as profiles.blocked_note always has.
-- 2. delete_my_personal_data() — called by deleteAccount right before the Auth
--    account goes. Removes what only that person owns but no foreign key ties
--    to the account: invitations to their verified e-mail that were never
--    accepted, and their volunteer applications. It also clears the e-mail
--    from audit rows they made before DB-14 (actor id stays; rows stay). The
--    rest goes with the account by foreign key (profile, membership, page
--    views, approver scope cascade; authors.profile_id and every *_by column
--    are set null — the public author profile stays, it is editorial content).
--    Refuses for the last active admin (the account deletion would fail on
--    keep_one_admin anyway) and without the second factor a role requires.
-- 3. unreferenced_uploads(paths) — of the given `{uid}/{file}` paths in
--    entry-images / entry-audio, those whose file name appears in no row of
--    any public table (content, revisions, settings, menus — everything except
--    the audit log and rate limits). deleteAccount removes
--    only those through the Storage API; a file used anywhere stays. Service
--    role only (it reads every table).
-- 4. audit_row() takes extra private columns as trigger arguments after the
--    key; volunteer applications keep name, topics and message out of the log,
--    so deleting an application no longer copies its text into audit_log.
-- 5. A change of profiles.email is audited — that it changed, not the value.
--
-- Default privileges are revoked (20261013000210): every grant is explicit.
-- Tests: supabase/tests/gdpr-completeness.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4. Extra private columns per audited table
-- ---------------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  key text := tg_argv[0];
  -- Never in the log: contact data and secrets, plus the columns the trigger
  -- names after the key (free text a person wrote about themselves).
  private text[] := array['email', 'phone', 'blocked_note', 'stripe_customer_id',
                          'stripe_subscription_id'] || coalesce(tg_argv[1:], '{}'::text[]);
  row_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - private end;
  row_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - private end;
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
  field text;
begin
  if tg_op = 'UPDATE' then
    for field in select jsonb_object_keys(row_new) loop
      if row_new -> field is distinct from row_old -> field then
        changed_old := changed_old || jsonb_build_object(field, row_old -> field);
        changed_new := changed_new || jsonb_build_object(field, row_new -> field);
      end if;
    end loop;
    row_old := changed_old;
    row_new := changed_new;
  end if;
  perform write_audit(
    tg_table_name || '.' || lower(tg_op),
    coalesce(to_jsonb(new) ->> key, to_jsonb(old) ->> key),
    jsonb_strip_nulls(jsonb_build_object('old', row_old, 'new', row_new)));
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

drop trigger volunteer_applications_audit on public.volunteer_applications;
create trigger volunteer_applications_audit
  after update or delete on public.volunteer_applications
  for each row execute function public.audit_row('id', 'name', 'topics', 'message');

-- ---------------------------------------------------------------------------
-- 5. E-mail changes are audited (without the address)
-- ---------------------------------------------------------------------------
create or replace function public.audit_profile_email()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform write_audit('profiles.email', new.id::text,
    jsonb_build_object('changed', jsonb_build_array('email')));
  return null;
end;
$$;
revoke execute on function public.audit_profile_email() from public, anon, authenticated;

create trigger profiles_email_audit
  after update of email on public.profiles
  for each row when (old.email is distinct from new.email)
  execute function public.audit_profile_email();

-- ---------------------------------------------------------------------------
-- Helper: the caller's e-mail, only once it is confirmed
-- ---------------------------------------------------------------------------
create or replace function public.my_confirmed_email()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;
-- Called only by the definer RPCs below.
revoke execute on function public.my_confirmed_email() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. The rest of one's own data, for the export
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
        'approverAuthors', i.approver_authors, 'createdAt', i.created_at,
        'expiresAt', i.expires_at, 'acceptedAt', i.accepted_at, 'revokedAt', i.revoked_at)
        order by i.created_at)
      from invitations i where my_email is not null and i.email = my_email), '[]'::jsonb),
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
      from entry_revisions r where r.saved_by = me), '[]'::jsonb));
end;
$$;
revoke execute on function public.my_personal_data() from public, anon;
grant execute on function public.my_personal_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. What the account deletion removes besides the account itself
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

  if my_email is not null then
    with gone as (
      delete from invitations i
      where i.email = my_email and i.accepted_at is null
      returning 1)
    select count(*)::integer into invitations_removed from gone;

    with gone as (
      delete from volunteer_applications v where lower(v.email) = my_email returning 1)
    select count(*)::integer into applications_removed from gone;
  end if;

  -- Rows written before DB-14 carried the actor's e-mail; the id stays.
  update audit_log set actor_email = null where actor = me and actor_email is not null;

  return jsonb_build_object('invitations', invitations_removed,
                            'volunteerApplications', applications_removed);
end;
$$;
revoke execute on function public.delete_my_personal_data() from public, anon;
grant execute on function public.delete_my_personal_data() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Which of a user's uploads nothing uses any more
-- ---------------------------------------------------------------------------
create or replace function public.unreferenced_uploads(p_paths text[])
returns text[]
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  -- Only `{uuid}/{file}` paths with a plain file name; anything else is kept.
  remaining text[] := array(
    select distinct p from unnest(coalesce(p_paths, '{}'::text[])) p
    where p ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{8,200}$');
  used text[];
  tbl text;
begin
  -- Every table that has a text, JSON or text-array column; each is read once,
  -- the whole row as text against every remaining file.
  for tbl in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      -- Logs, not content: a file only mentioned there is not in use.
      and c.relname not in ('audit_log', 'rate_limits')
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          and a.atttypid in ('text'::regtype, 'character varying'::regtype, 'json'::regtype,
                             'jsonb'::regtype, 'text[]'::regtype,
                             'character varying[]'::regtype))
    order by c.relname
  loop
    exit when cardinality(remaining) = 0;
    -- The file name ({uuid}.{ext}) is unique, so it finds the file in any form
    -- of its URL (public, render, encoded inside another URL).
    execute format(
      'select coalesce(array_agg(distinct f), ''{}'') from public.%I t, unnest($1) f
       where strpos(t::text, split_part(f, ''/'', 2)) > 0', tbl)
      into used using remaining;
    remaining := array(select unnest(remaining) except select unnest(used));
  end loop;
  return coalesce(remaining, '{}');
end;
$$;
revoke execute on function public.unreferenced_uploads(text[]) from public, anon, authenticated;
grant execute on function public.unreferenced_uploads(text[]) to service_role;
