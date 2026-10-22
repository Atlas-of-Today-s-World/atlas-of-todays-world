-- Careers in the main menu, right after About (on desktop above the globe too,
-- and in the mobile menu). The items after it move one place down; the footer
-- link from 20261022001000 stays. Admin → Site menus can move or hide it.

update public.nav_items
   set position = position + 1
 where menu = 'main'
   and position > coalesce((select max(position) from public.nav_items
                             where menu = 'main' and href = '/about'), 1000)
   and not exists (select 1 from public.nav_items where menu = 'main' and href = '/careers');

insert into public.nav_items (menu, label, href, position)
select 'main', 'Careers', '/careers',
       coalesce((select max(position) + 1 from public.nav_items
                 where menu = 'main' and href = '/about'),
                (select coalesce(max(position) + 1, 0) from public.nav_items where menu = 'main'))
where not exists (select 1 from public.nav_items where menu = 'main' and href = '/careers');
