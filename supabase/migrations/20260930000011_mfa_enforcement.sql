-- =============================================================================
-- Vynucení dvoufázového ověření pro citlivé role (PLAN E10, DB-07)
-- =============================================================================
--
-- Role v security_settings.require_2fa_roles (výchozí admin a permission-admin)
-- mají oprávnění jen se session na úrovni aal2 (heslo/Google + TOTP). Bez
-- druhého faktoru pro DB vypadají jako bez role — nic nezapíšou a administrace
-- je pošle nastavit či ověřit TOTP (aplikace volá mfa_status()).
--
-- Servisní klíč (auth.uid() je null) se netýká: nemá profil.
-- =============================================================================

create or replace function public.mfa_ok()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1
        from profiles p
        join security_settings s on s.id = 1
        where p.id = auth.uid() and p.role_id = any (s.require_2fa_roles));
$$;

create or replace function public.is_active()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select mfa_ok() and exists (
    select 1 from profiles
    where id = auth.uid() and status = 'active' and deleted_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select mfa_ok() and exists (
    select 1
    from profiles p
    join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null and r.locked
  );
$$;

create or replace function public.has_perm(p_section text, p_action text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_action in ('v', 'c', 'e', 'd') and mfa_ok() and exists (
    select 1
    from profiles p
    join roles r on r.id = p.role_id
    left join role_permissions rp on rp.role_id = r.id and rp.section = p_section
    where p.id = auth.uid()
      and p.status = 'active'
      and p.deleted_at is null
      and (r.locked or strpos(coalesce(rp.actions, ''), p_action) > 0)
  );
$$;

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
    'users', 'members', 'permissions']) as s (section)
  left join role_permissions rp on rp.role_id = r.id and rp.section = s.section
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null and mfa_ok();
$$;

-- Pro aplikaci: musí tento účet mít druhý faktor, a má ho v této session?
create or replace function public.mfa_status()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'required', exists (
      select 1 from profiles p join security_settings s on s.id = 1
      where p.id = auth.uid() and p.role_id = any (s.require_2fa_roles)),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'));
$$;

revoke execute on function public.mfa_ok(), public.mfa_status() from public, anon;
grant execute on function public.mfa_ok(), public.mfa_status() to authenticated;
