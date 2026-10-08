-- =============================================================================
-- Unpublished entries: the user is checked once per query, the owner per row
-- =============================================================================
--
-- RLS performance (review 2026-10-07, D-H2). The read policies of `entries` and
-- of its child tables called can_read_unpublished(owner_id) — or
-- can_read_entry(entry_id), which calls it — for every row. Each call runs
-- is_active(), is_admin(), has_perm('approvals','v'), has_perm('news','v') and
-- a news-scope lookup (~10 sub-queries), and SECURITY DEFINER functions are
-- never inlined, so an admin list of drafts paid that price per row.
--
-- Only one part of can_read_unpublished depends on the row:
--
--   can_read_unpublished(o)
--     = is_active() and (is_admin() or o = auth.uid() or has_perm('approvals','v')
--                        or (has_perm('news','v') and news_scope <> 'own'))
--     = can_read_any_unpublished() or (o = auth.uid() and is_active())
--
-- can_read_any_unpublished() takes no argument, so policies call it as
-- `(select public.can_read_any_unpublished())` — once per query — and keep a
-- plain comparison for the owner. The same authorization; the differential
-- test supabase/tests/rls-unpublished.test.mjs proves the policies still allow
-- exactly what can_read_unpublished() allows.
--
-- can_read_unpublished() and can_read_entry() stay as they are for the
-- functions that call them (preview links, save_topic_as_template).
-- Write policies (can_edit_entry / can_write_entry / can_approve_entry) are not
-- part of this change: they only run for the rows an UPDATE/DELETE targets.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- May the signed-in user read EVERY unpublished entry, whoever owns it?
-- Mirrors can_read_unpublished() without its owner branch.
create function public.can_read_any_unpublished()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when not is_active() then false
    when is_admin() then true
    when has_perm('approvals', 'v') then true
    when has_perm('news', 'v') then coalesce((select r.news_scope <> 'own' from roles r
                                              join profiles p on p.role_id = r.id
                                              where p.id = auth.uid()), false)
    else false
  end;
$$;

revoke execute on function public.can_read_any_unpublished() from public, anon;
grant execute on function public.can_read_any_unpublished() to authenticated;

-- The per-row rest of can_read_entry() once can_read_any_unpublished() is
-- known to be false: the entry is published, or it is the caller's own and
-- their account is active. SECURITY DEFINER like can_read_entry(), because
-- readers (non-staff) don't see published entries through their session but
-- do read their FAQ, tiles and tile notes through these policies.
create function public.entry_published_or_own(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from entries e
                  where e.id = p_entry
                    and (e.status = 'published' or (e.owner_id = auth.uid() and is_active())));
$$;

revoke execute on function public.entry_published_or_own(uuid) from public, anon;
grant execute on function public.entry_published_or_own(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------

alter policy entries_read on public.entries
  using ((status = 'published' and (select public.is_staff()))
         or (select public.can_read_any_unpublished())
         or (owner_id = (select auth.uid()) and (select public.is_active())));

-- ---------------------------------------------------------------------------
-- Child tables that join `entries` as the caller (its RLS applies inside)
-- ---------------------------------------------------------------------------

alter policy entry_chapters_read on public.entry_chapters
  using (exists (select 1 from public.entries e
                  where e.id = entry_id
                    and (e.status = 'published'
                         or (select public.can_read_any_unpublished())
                         or (e.owner_id = (select auth.uid()) and (select public.is_active())))));

alter policy entry_countries_read on public.entry_countries
  using (exists (select 1 from public.entries e
                  where e.id = entry_id
                    and (e.status = 'published'
                         or (select public.can_read_any_unpublished())
                         or (e.owner_id = (select auth.uid()) and (select public.is_active())))));

alter policy resources_read on public.resources
  using (entry_id is null
         or exists (select 1 from public.entries e
                     where e.id = entry_id
                       and (e.status = 'published'
                            or (select public.can_read_any_unpublished())
                            or (e.owner_id = (select auth.uid()) and (select public.is_active())))));

alter policy preview_links_select on public.preview_links
  using (exists (select 1 from public.entries e
                  where e.id = entry_id
                    and ((select public.can_read_any_unpublished())
                         or (e.owner_id = (select auth.uid()) and (select public.is_active())))));

-- ---------------------------------------------------------------------------
-- Child tables that used can_read_entry(entry_id)
-- ---------------------------------------------------------------------------

-- Signed in: can_read_entry(x) = the entry exists and (it is published or
-- can_read_unpublished(owner)). entry_id is a NOT NULL foreign key to entries
-- (on delete cascade), so the entry of a stored row always exists and the
-- whole-table branch can stand outside the per-row lookup.
alter policy entry_faq_read on public.entry_faq
  using ((select public.can_read_any_unpublished()) or public.entry_published_or_own(entry_id));

alter policy entry_tile_notes_read on public.entry_tile_notes
  using ((select public.can_read_any_unpublished()) or public.entry_published_or_own(entry_id));

alter policy learn_more_tiles_read on public.learn_more_tiles
  using (entry_id is not null
         and ((select public.can_read_any_unpublished()) or public.entry_published_or_own(entry_id)));

-- Anonymous: auth.uid() is null, so can_read_entry(x) meant "x is published".
-- anon sees exactly the published entries (entries_public), so a plain join
-- says the same without a function call per row — as entry_chapters_public does.
alter policy entry_faq_public on public.entry_faq
  using (exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published'));

alter policy entry_tile_notes_public on public.entry_tile_notes
  using (exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published'));

alter policy learn_more_tiles_public on public.learn_more_tiles
  using (entry_id is not null
         and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published'));
