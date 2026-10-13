-- =============================================================================
-- New permission section `site` ("Site content & settings")
-- =============================================================================
--
-- Guards site-wide editable content that later migrations add (organisation
-- settings, social links, menus, legal/about pages, UI texts, home page,
-- patron settings). This migration only introduces the section:
--
-- 1. role_permissions.section CHECK accepts 'site'.
-- 2. my_permissions() lists 'site' (same function as 20260930000011, MFA rule
--    included; only the section list changes).
-- 3. Default grants (owner decision: every editorial role in the admin may edit
--    site content): `site` = vced for the built-in roles that can edit articles
--    (`news` with "e") — content-editor and publisher out of the box. The admin
--    role is locked and has every section implicitly; its permissions are never
--    stored (guard_role_permissions refuses them). Inserted as data with
--    `on conflict do nothing`, so a grant changed in the admin is kept.
-- =============================================================================

alter table public.role_permissions drop constraint role_permissions_section_check;
alter table public.role_permissions add constraint role_permissions_section_check
  check (section in (
    'news', 'approvals', 'areas',
    'regions', 'layers', 'appearance', 'specials',
    'site',
    'users', 'members', 'permissions'));

create or replace function public.my_permissions()
returns table (section text, actions text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.section,
         case when r.locked then 'vced' else coalesce(rp.actions, '') end
  from profiles p
  join roles r on r.id = p.role_id
  cross join unnest(array[
    'news', 'approvals', 'areas', 'regions', 'layers', 'appearance', 'specials',
    'site', 'users', 'members', 'permissions']) as s (section)
  left join role_permissions rp on rp.role_id = r.id and rp.section = s.section
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null and mfa_ok();
$$;

insert into public.role_permissions (role_id, section, actions)
select rp.role_id, 'site', 'vced'
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
where rp.role_id in ('content-editor', 'publisher')
  and rp.section = 'news'
  and strpos(rp.actions, 'e') > 0
  and not r.locked
on conflict (role_id, section) do nothing;
