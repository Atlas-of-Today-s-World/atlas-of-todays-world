-- =============================================================================
-- Site menus editable in the admin (section `site`)
-- =============================================================================
--
-- The main menu (header on desktop and in the mobile menu) and the legal links
-- (footer and mobile menu) were constants in config/navigation.ts. They move
-- here so the team can rename, reorder, hide, add and remove items without a
-- deployment. The sign-in item stays in the code (it is part of the account
-- flow, not content). The app keeps today's items as its fallback: a failed
-- read never leaves the site without a menu.
--
-- 1. nav_items — one row per menu item, seeded with today's exact items and
--    labels. Everyone reads the visible ones; the team with `site` "v" also
--    the hidden ones; `site` c/e/d write.
--    * href: a path on this site (`/about`, `/news#latest`; never "//host")
--      or an https:// address. Whether a link is external is derived from it.
--    * is_primary: the highlighted pill ("Atlas Patrons"); compact_hidden: over
--      the globe the item waits in the full menu (little room there). Both only
--      in the main menu.
--    * requires_flag: the item shows only while that feature switch is on
--      (News follows `news_menu`, as before). A fixed list of switches.
-- 2. move_nav_item(id, up) — swaps an item with its neighbour in the same menu
--    in one transaction (invoker: RLS and the `site` "e" check still decide).
--
-- Grants are explicit (revoke all, then exactly what the policies need), so
-- nothing relies on Supabase's default privileges for new tables. No sequence:
-- the id is a uuid.
-- =============================================================================

create table public.nav_items (
  id             uuid primary key default gen_random_uuid(),
  menu           text not null check (menu in ('main', 'legal')),
  label          text not null check (char_length(btrim(label)) between 1 and 60),
  -- A path on this site (lowercase, no spaces; never protocol-relative "//")
  -- or an https:// address.
  href           text not null check (
    char_length(href) <= 500
    and (
      (href ~ '^/[a-z0-9/_#?=&.-]*$' and href !~ '^//')
      or href ~ '^https://[^\s/?#]+\S*$'
    )
  ),
  position       integer not null default 0 check (position between 0 and 1000),
  visible        boolean not null default true,
  is_primary     boolean not null default false,
  compact_hidden boolean not null default false,
  requires_flag  text check (requires_flag in ('news_menu', 'newsletter')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- The pill and the "full menu only" placement exist only in the main menu.
  constraint nav_items_main_only_styles check (
    menu = 'main' or not (is_primary or compact_hidden)
  )
);

create index nav_items_order on public.nav_items (menu, position, created_at);

-- Today's items, with today's labels (messages/en.json nav.*), in today's order.
insert into public.nav_items (menu, label, href, position, is_primary, compact_hidden, requires_flag)
select * from (values
  ('main', 'Topics', '/topics', 0, false, false, null),
  ('main', 'Countries', '/countries', 1, false, true, null),
  ('main', 'News', '/news', 2, false, true, 'news_menu'),
  ('main', 'About', '/about', 3, false, false, null),
  ('main', 'Support the Atlas', '/membership', 4, false, false, null),
  ('main', 'Atlas Patrons', '/membership', 5, true, false, null),
  ('legal', 'Privacy', '/privacy', 0, false, false, null),
  ('legal', 'Terms', '/terms', 1, false, false, null),
  ('legal', 'Accessibility', '/accessibility', 2, false, false, null)
) as seed (menu, label, href, position, is_primary, compact_hidden, requires_flag)
where not exists (select 1 from public.nav_items);

create trigger nav_items_stamp
  before update on public.nav_items
  for each row execute function public.stamp_row();

create trigger nav_items_audit
  after insert or update or delete on public.nav_items
  for each row execute function public.audit_row('id');

alter table public.nav_items enable row level security;

create policy nav_items_read_public on public.nav_items
  for select to anon
  using (visible);
create policy nav_items_read_team on public.nav_items
  for select to authenticated
  using (visible or (select public.has_perm('site', 'v')));
create policy nav_items_insert on public.nav_items
  for insert to authenticated
  with check ((select public.has_perm('site', 'c')));
create policy nav_items_update on public.nav_items
  for update to authenticated
  using ((select public.has_perm('site', 'e')))
  with check ((select public.has_perm('site', 'e')));
create policy nav_items_delete on public.nav_items
  for delete to authenticated
  using ((select public.has_perm('site', 'd')));

revoke all on public.nav_items from anon, authenticated;
grant select (
  id, menu, label, href, position, visible, is_primary, compact_hidden, requires_flag, created_at
) on public.nav_items to anon;
grant select on public.nav_items to authenticated;
grant insert (
  menu, label, href, position, visible, is_primary, compact_hidden, requires_flag
) on public.nav_items to authenticated;
-- The menu itself is fixed once an item exists (move = delete + add).
grant update (
  label, href, position, visible, is_primary, compact_hidden, requires_flag
) on public.nav_items to authenticated;
grant delete on public.nav_items to authenticated;

-- ---------------------------------------------------------------------------
-- Reordering: swap with the neighbour above (p_up) or below, within one menu
-- ---------------------------------------------------------------------------
create or replace function public.move_nav_item(p_id uuid, p_up boolean)
returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  which text;
  ordered uuid[];
  here integer;
  there integer;
begin
  if not (select public.has_perm('site', 'e')) then
    raise exception 'You can''t reorder menu items.' using errcode = '42501';
  end if;
  select menu into which from nav_items where id = p_id;
  if which is null then
    raise exception 'The menu item no longer exists.' using errcode = '22023';
  end if;
  select array_agg(id order by position, created_at, id) into ordered
    from nav_items where menu = which;
  here := array_position(ordered, p_id);
  there := case when p_up then here - 1 else here + 1 end;
  if there < 1 or there > cardinality(ordered) then
    return;
  end if;
  ordered[here] := ordered[there];
  ordered[there] := p_id;
  -- Renumber 0…n-1 within the menu (positions may have had gaps or ties).
  update nav_items t
     set position = o.n - 1
    from unnest(ordered) with ordinality as o (id, n)
   where t.id = o.id and t.position is distinct from (o.n - 1)::integer;
end;
$$;

revoke execute on function public.move_nav_item(uuid, boolean) from public, anon;
grant execute on function public.move_nav_item(uuid, boolean) to authenticated;
