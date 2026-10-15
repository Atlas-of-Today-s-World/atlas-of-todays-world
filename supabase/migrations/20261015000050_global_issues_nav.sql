-- =============================================================================
-- Header: "Global issues" right after "Topics" (owner's request, 2026-10-15)
-- =============================================================================
--
-- The new overview page /global-issues lists every global issue the way
-- /topics lists the topics, and gets its own item in the main menu next to
-- Topics. The code's fallback menu (config/navigation.ts) has it as well.
--
-- Only once, and only if nobody has added such an item yet (Admin → Site
-- menus): a row with href '/global-issues' already in the main menu, visible
-- or hidden, means the team placed it themselves. The items after Topics move
-- one place down; when Topics itself was removed, the new item goes first.
-- Positions stay within the CHECK (0…1000): a menu that has used them all up
-- is left alone rather than failing the deploy.
-- =============================================================================

do $$
declare
  after_topics integer;
begin
  if exists (
    select 1 from public.nav_items where menu = 'main' and href = '/global-issues'
  ) then
    return;
  end if;
  if exists (select 1 from public.nav_items where menu = 'main' and position >= 1000) then
    return;
  end if;

  select min(position) + 1 into after_topics
  from public.nav_items
  where menu = 'main' and href = '/topics';
  after_topics := coalesce(after_topics, 0);

  update public.nav_items
  set position = position + 1
  where menu = 'main' and position >= after_topics;

  insert into public.nav_items (menu, label, href, position)
  values ('main', 'Global issues', '/global-issues', after_topics);
end
$$;
