-- =============================================================================
-- Admin gaps: author URLs and accounts, role order
-- =============================================================================
--
-- 1. authors.slug becomes editable in the admin. When it changes, the old
--    public URL (/authors/<old>) is redirected to the new one in the same
--    statement (trigger, definer: the redirect is part of the rename, whoever
--    may rename the author — RLS authors_change — gets it, also without
--    `news` "c" on redirects). Redirects that pointed at the old URL are
--    pointed at the new one (no chains), and a redirect *from* the new URL
--    is dropped (the URL is a live page again; it would only loop).
-- 2. authors.profile_id (which team account an author profile belongs to; the
--    account may then edit that bio, policy authors_change) is set only
--    through set_author_account(): `users` "e" (admin included), audited.
--    Before, anyone with `news` "c" could insert a profile linked to any
--    account and anyone editing all entries could relink one. The
--    table-wide INSERT / UPDATE grants become column grants without
--    profile_id. author_account() reads the link back for `users` "v" (the
--    column itself stays unreadable for `authenticated`, 20261008000030).
-- 3. move_role(id, up) — swaps a role with its neighbour in the menu order
--    (invoker: RLS roles_change and the `permissions` "e" check decide).
--    The reader role is not part of the team order and is left alone.
--
-- Default privileges are revoked (20261013000210): every grant is explicit.
-- Tests: supabase/tests/admin-gaps.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Renaming an author's URL leaves a redirect behind
-- ---------------------------------------------------------------------------
create or replace function public.authors_slug_redirect()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  old_path text := '/authors/' || old.slug;
  new_path text := '/authors/' || new.slug;
begin
  if new.slug is not distinct from old.slug then
    return null;
  end if;
  delete from redirects where from_path = new_path;
  update redirects set to_path = new_path where to_path = old_path;
  insert into redirects (from_path, to_path, permanent)
  values (old_path, new_path, true)
  on conflict (from_path) do update set to_path = excluded.to_path, permanent = true;
  return null;
end;
$$;
revoke execute on function public.authors_slug_redirect() from public, anon, authenticated;

create trigger authors_slug_redirect
  after update of slug on public.authors
  for each row execute function public.authors_slug_redirect();

-- ---------------------------------------------------------------------------
-- 2. Linking an author profile to a team account
-- ---------------------------------------------------------------------------
revoke insert, update on public.authors from authenticated;
grant insert (name, slug, photo_url, bio, positionality) on public.authors to authenticated;
grant update (name, slug, photo_url, bio, positionality) on public.authors to authenticated;

-- p_profile null = unlink. Only an active team account can be linked, and
-- each account to at most one author profile (authors.profile_id is unique).
create or replace function public.set_author_account(p_author uuid, p_profile uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  before uuid;
  taken text;
begin
  if not (select public.has_perm('users', 'e')) then
    raise exception 'Only account managers can link an author to an account.' using errcode = '42501';
  end if;
  select a.profile_id into before from authors a where a.id = p_author for update;
  if not found then
    raise exception 'The author profile no longer exists.' using errcode = '22023';
  end if;
  if p_profile is not null then
    if not exists (select 1 from profiles p
                   where p.id = p_profile and p.kind = 'staff' and p.deleted_at is null) then
      raise exception 'Only a team account can be linked to an author.' using errcode = '22023';
    end if;
    select a.name into taken from authors a where a.profile_id = p_profile and a.id <> p_author;
    if taken is not null then
      raise exception 'This account is already linked to the author %.', taken using errcode = '23505';
    end if;
  end if;
  if before is not distinct from p_profile then
    return;
  end if;
  update authors set profile_id = p_profile where id = p_author;
  perform write_audit('authors.account', p_author::text,
    jsonb_build_object('from', before, 'to', p_profile));
end;
$$;
revoke execute on function public.set_author_account(uuid, uuid) from public, anon;
grant execute on function public.set_author_account(uuid, uuid) to authenticated;

-- The linked account of one author, for those who see accounts (else an error).
create or replace function public.author_account(p_author uuid)
returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not (select public.has_perm('users', 'v')) then
    raise exception 'Only account managers can see which account an author belongs to.'
      using errcode = '42501';
  end if;
  return (select a.profile_id from authors a where a.id = p_author);
end;
$$;
revoke execute on function public.author_account(uuid) from public, anon;
grant execute on function public.author_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Role order
-- ---------------------------------------------------------------------------
create or replace function public.move_role(p_id text, p_up boolean)
returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  ordered text[];
  here integer;
  there integer;
begin
  if not (select public.has_perm('permissions', 'e')) then
    raise exception 'You can''t reorder roles.' using errcode = '42501';
  end if;
  select array_agg(id order by position, created_at, id) into ordered
    from roles where id <> 'reader';
  here := array_position(ordered, p_id);
  if here is null then
    raise exception 'The role no longer exists.' using errcode = '22023';
  end if;
  there := case when p_up then here - 1 else here + 1 end;
  if there < 1 or there > cardinality(ordered) then
    return;
  end if;
  ordered[here] := ordered[there];
  ordered[there] := p_id;
  -- Renumber 0, 10, 20… (positions may have had gaps or ties, e.g. new roles).
  update roles r
     set position = (o.n - 1) * 10
    from unnest(ordered) with ordinality as o (id, n)
   where r.id = o.id and r.position is distinct from ((o.n - 1) * 10)::integer;
end;
$$;
revoke execute on function public.move_role(text, boolean) from public, anon;
grant execute on function public.move_role(text, boolean) to authenticated;
