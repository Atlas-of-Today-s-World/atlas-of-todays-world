-- =============================================================================
-- Účty, role, oprávnění a záznam změn
-- =============================================================================
--
-- Model odpovídá matici oprávnění z ukázky: role × sekce × {v, c, e, d}
-- (zobrazit, přidat, upravit, smazat). Role `admin` je zamčená a smí všechno.
-- Dvě věci se do mřížky nevejdou a mají vlastní sloupce u role: čí články
-- smí upravovat (`news_scope`) a kam sahá její schvalování (`approval_scope`).
--
-- Rozhodování je v databázi, ne v aplikaci: každá tabulka má RLS a pravidla
-- se opírají o `has_perm()`. Aplikace smí oprávnění jen zobrazovat.
--
-- Požadavek bez přihlášení (`auth.uid()` je null) je buď anonymní čtenář —
-- ten má jen SELECT, žádný zápis — nebo servisní klíč (importy, webhooky).
-- Ochranné triggery proto servisní klíč pouštějí; anonym se k zápisu nedostane
-- už kvůli chybějícím oprávněním.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role a oprávnění
-- ---------------------------------------------------------------------------

create table public.roles (
  id              text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 40),
  name            text not null check (length(btrim(name)) between 1 and 60),
  note            text not null default '' check (length(note) <= 500),
  locked          boolean not null default false,
  news_scope      text not null default 'none' check (news_scope in ('none', 'own', 'all')),
  approval_scope  text not null default 'none' check (approval_scope in ('none', 'assigned', 'global')),
  position        integer not null default 100,
  created_at      timestamptz not null default now()
);

comment on column public.roles.locked is
  'Zamčená role (admin) má všechna oprávnění a nedá se omezit ani smazat.';
comment on column public.roles.news_scope is
  'Čí články smí role upravovat: none / own / all.';
comment on column public.roles.approval_scope is
  'Kam sahá schvalování: none / assigned (přidělené země a autoři) / global.';

-- Sekce jsou pevný seznam: přidává se s kódem, který je používá, ne v administraci.
create table public.role_permissions (
  role_id  text not null references public.roles (id) on delete cascade,
  section  text not null check (section in (
             'news', 'approvals', 'areas',
             'regions', 'layers', 'appearance', 'specials',
             'users', 'members', 'permissions')),
  -- Přidat, upravit ani smazat nedává smysl bez zobrazení, proto vždy začíná „v".
  actions  text not null check (actions ~ '^vc?e?d?$'),
  primary key (role_id, section)
);

-- ---------------------------------------------------------------------------
-- Profily
-- ---------------------------------------------------------------------------

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  name             text not null default '' check (length(name) <= 120),
  phone            text check (length(phone) <= 40),
  role_id          text not null default 'reader' references public.roles (id),
  kind             text not null default 'reader' check (kind in ('staff', 'reader')),
  status           text not null default 'active' check (status in ('active', 'pending', 'blocked')),
  blocked_note     text check (length(blocked_note) <= 500),
  -- Přepne jednoho přiděleného schvalovatele na globálního. Smí jen admin.
  approval_global  boolean not null default false,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz,
  deleted_at       timestamptz
);

create unique index profiles_email_live on public.profiles (lower(email)) where deleted_at is null;
create index profiles_role on public.profiles (role_id);

-- Přiřazení schvalovatele: země (cizí klíč na countries dostane až geografie)…
create table public.approver_countries (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  country_iso3  text not null check (country_iso3 ~ '^[A-Z]{3}$'),
  primary key (user_id, country_iso3)
);

-- …a autoři, jejichž články smí schvalovat.
create table public.approver_authors (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (user_id, author_id),
  check (user_id <> author_id)
);

-- Kdo se smí stát členem redakce. Čtenáři se registrují volně.
create table public.allowed_emails (
  value     text primary key check (
              value = lower(value)
              and value ~ '^(@[a-z0-9.-]+\.[a-z]{2,}|[^@[:space:]]+@[a-z0-9.-]+\.[a-z]{2,})$'),
  note      text not null default '' check (length(note) <= 300),
  added_by  uuid references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now()
);

create table public.security_settings (
  id                 integer primary key default 1 check (id = 1),
  session_hours      integer not null default 12 check (session_hours between 1 and 720),
  lock_after         integer not null default 5 check (lock_after between 1 and 20),
  invite_only        boolean not null default true,
  -- V ostrém provozu jen náhled „jak to vidí role", nikdy převzetí cizí relace.
  impersonation      boolean not null default false,
  require_2fa_roles  text[] not null default array['admin', 'permission-admin']
);
insert into public.security_settings default values;

-- ---------------------------------------------------------------------------
-- Záznam změn
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor        uuid,
  actor_email  text,
  action       text not null,
  target       text,
  detail       jsonb not null default '{}'::jsonb
);
create index audit_log_at on public.audit_log (at desc);
create index audit_log_target on public.audit_log (target);

-- ---------------------------------------------------------------------------
-- Pomocné funkce pro pravidla
-- ---------------------------------------------------------------------------
-- `security definer` + pevná `search_path`: funkce čtou profily a role i tam,
-- kam volající sám nevidí, a nedají se podstrčit cizím schématem.

create or replace function public.is_active()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'active' and deleted_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
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
  select exists (
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

create or replace function public.my_role()
returns public.roles
language sql stable security definer
set search_path = public, pg_temp
as $$
  select r.*
  from profiles p
  join roles r on r.id = p.role_id
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null;
$$;

-- Co přihlášený smí — aplikace podle toho kreslí menu. Rozhoduje ale RLS.
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
  where p.id = auth.uid() and p.status = 'active' and p.deleted_at is null;
$$;

create or replace function public.write_audit(p_action text, p_target text, p_detail jsonb default '{}'::jsonb)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into audit_log (actor, actor_email, action, target, detail)
  values (
    auth.uid(),
    (select email from profiles where id = auth.uid()),
    p_action, p_target, coalesce(p_detail, '{}'::jsonb));
$$;

-- Obecný zápis do záznamu změn. Argument triggeru = sloupec s identifikací.
create or replace function public.audit_row()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  key text := tg_argv[0];
  row_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  row_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  perform write_audit(
    tg_table_name || '.' || lower(tg_op),
    coalesce(row_new ->> key, row_old ->> key),
    jsonb_strip_nulls(jsonb_build_object('old', row_old, 'new', row_new)));
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ochrana rolí
-- ---------------------------------------------------------------------------

create or replace function public.guard_roles()
returns trigger
language plpgsql
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
    return old;
  end if;
  if tg_op = 'INSERT' and new.locked then
    raise exception 'Only the built-in admin role is locked.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.locked is distinct from old.locked or new.id is distinct from old.id) then
    raise exception 'A role cannot be locked, unlocked or renamed at the id level.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger roles_guard
  before insert or update or delete on public.roles
  for each row execute function public.guard_roles();

create or replace function public.guard_role_permissions()
returns trigger
language plpgsql
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
  -- Kdo spravuje oprávnění, nesmí je přidávat vlastní roli — jinak by si
  -- „permission admin" jedním kliknutím vzal i obsah, který mu role zakazuje.
  if not is_admin() and target = (select role_id from profiles where id = auth.uid()) then
    raise exception 'You cannot change the permissions of your own role.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger role_permissions_guard
  before insert or update or delete on public.role_permissions
  for each row execute function public.guard_role_permissions();

-- ---------------------------------------------------------------------------
-- Ochrana profilů
-- ---------------------------------------------------------------------------

create or replace function public.guard_profiles()
returns trigger
language plpgsql
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
  if me is null then
    return new;  -- servisní klíč: registrace, importy, webhooky
  end if;

  may_users := has_perm('users', 'e');
  may_members := has_perm('members', 'e');

  if tg_op = 'INSERT' then
    if not has_perm('users', 'c') then
      raise exception 'Your role cannot add accounts.' using errcode = '42501';
    end if;
  else
    -- Kdo nemá správu účtů, smí na sobě měnit jen jméno a telefon
    -- a správce členství u cizích účtů jen stav (blokace).
    if not may_users then
      if me = old.id and not may_members then
        if (new.email, new.role_id, new.kind, new.status, new.blocked_note, new.approval_global, new.deleted_at)
           is distinct from
           (old.email, old.role_id, old.kind, old.status, old.blocked_note, old.approval_global, old.deleted_at) then
          raise exception 'You can change only your own name and phone.' using errcode = '42501';
        end if;
      elsif may_members and me <> old.id then
        if (new.email, new.name, new.phone, new.role_id, new.kind, new.approval_global, new.deleted_at)
           is distinct from
           (old.email, old.name, old.phone, old.role_id, old.kind, old.approval_global, old.deleted_at) then
          raise exception 'Membership managers can only block or unblock an account.' using errcode = '42501';
        end if;
      else
        raise exception 'Your role cannot change accounts.' using errcode = '42501';
      end if;
    end if;

    -- Nikdo kromě admina si nemění vlastní roli ani stav.
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

  -- Zamčenou roli (admin) přiděluje jen admin.
  select * into new_role from roles where id = new.role_id;
  if new_role.locked and role_changed and not is_admin() then
    raise exception 'Only an admin can give the admin role.' using errcode = '42501';
  end if;

  -- Redakční účet jen z povolené adresy, je-li zapnutá registrace na pozvánku.
  select * into settings from security_settings where id = 1;
  if settings.invite_only and became_staff
     and not exists (
       select 1 from allowed_emails a
       where a.value = lower(new.email)
          or (left(a.value, 1) = '@' and lower(new.email) like '%' || a.value)) then
    raise exception 'This address is not on the allowed e-mails list.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.guard_profiles();

-- Poslední aktivní admin nesmí zmizet — jinak by se nedalo nic spravovat.
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  was_admin boolean;
begin
  -- Hlídá se jen odchod admina; čerstvá databáze bez admina se tím nezasekne.
  select r.locked into was_admin from roles r where r.id = old.role_id;
  if not coalesce(was_admin, false) or old.status <> 'active' or old.deleted_at is not null then
    return null;
  end if;
  if not exists (
    select 1 from profiles p join roles r on r.id = p.role_id
    where r.locked and p.status = 'active' and p.deleted_at is null) then
    raise exception 'At least one active admin has to remain.' using errcode = '42501';
  end if;
  return null;
end;
$$;

create constraint trigger profiles_keep_admin
  after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function public.keep_one_admin();

-- Záznam změn u citlivých polí profilu (ne u každého přihlášení).
create trigger profiles_audit
  after update on public.profiles
  for each row
  when (old.role_id is distinct from new.role_id
     or old.status is distinct from new.status
     or old.kind is distinct from new.kind
     or old.approval_global is distinct from new.approval_global
     or old.deleted_at is distinct from new.deleted_at)
  execute function public.audit_row('email');

create trigger roles_audit
  after insert or update or delete on public.roles
  for each row execute function public.audit_row('id');

create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function public.audit_row('role_id');

create trigger allowed_emails_audit
  after insert or delete on public.allowed_emails
  for each row execute function public.audit_row('value');

create trigger security_settings_audit
  after update on public.security_settings
  for each row execute function public.audit_row('id');

create trigger approver_countries_audit
  after insert or delete on public.approver_countries
  for each row execute function public.audit_row('user_id');

create trigger approver_authors_audit
  after insert or delete on public.approver_authors
  for each row execute function public.audit_row('user_id');

-- ---------------------------------------------------------------------------
-- Nový účet z Supabase Auth → profil čtenáře
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles (id, email, name, role_id, kind, status)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    'reader', 'reader', 'active');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Výchozí role (stejné jako v ukázce; „Observer" je redakce jen ke čtení,
-- „Reader" veřejný čtenář bez přístupu do administrace)
-- ---------------------------------------------------------------------------

insert into public.roles (id, name, note, locked, news_scope, approval_scope, position) values
  ('admin', 'Admin', 'Full access, including permissions. Cannot be limited.', true, 'all', 'global', 0),
  ('permission-admin', 'Permission admin',
   'Accounts and permissions only. Deliberately cannot touch content.', false, 'none', 'none', 10),
  ('content-editor', 'Content editor',
   'Edits and approves every entry in the Atlas, whoever wrote it.', false, 'all', 'global', 20),
  ('content-approver', 'Content approver',
   'Approves only the entries it has been assigned — by country or by author.', false, 'none', 'assigned', 30),
  ('publisher', 'Publisher',
   'Writes and edits its own entries and sends them for approval.', false, 'own', 'none', 40),
  ('data-editor', 'Data editor',
   'Indicators, palettes and the look of the map. No say over the text.', false, 'none', 'none', 50),
  ('observer', 'Observer',
   'Sees the editorial queue without being able to change anything.', false, 'none', 'none', 60),
  ('reader', 'Reader', 'A registered reader. No access to the administration.', false, 'none', 'none', 99);

insert into public.role_permissions (role_id, section, actions) values
  ('permission-admin', 'users', 'vced'),
  ('permission-admin', 'permissions', 'vced'),
  ('permission-admin', 'members', 've'),
  ('content-editor', 'news', 'vced'),
  ('content-editor', 'approvals', 'vced'),
  ('content-editor', 'regions', 'v'),
  ('content-editor', 'layers', 'v'),
  ('content-editor', 'specials', 'v'),
  ('content-approver', 'news', 'v'),
  ('content-approver', 'approvals', 've'),
  ('publisher', 'news', 'vce'),
  ('publisher', 'regions', 'v'),
  ('publisher', 'layers', 'v'),
  ('data-editor', 'regions', 'vce'),
  ('data-editor', 'layers', 'vce'),
  ('data-editor', 'appearance', 'vce'),
  ('data-editor', 'specials', 'vced'),
  ('observer', 'news', 'v');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.approver_countries enable row level security;
alter table public.approver_authors enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.security_settings enable row level security;
alter table public.audit_log enable row level security;

-- Názvy rolí vidí každý přihlášený (kreslí se u účtů), měnit je smí jen správa oprávnění.
create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_add on public.roles for insert to authenticated with check (has_perm('permissions', 'c'));
create policy roles_change on public.roles for update to authenticated
  using (has_perm('permissions', 'e')) with check (has_perm('permissions', 'e'));
create policy roles_remove on public.roles for delete to authenticated using (has_perm('permissions', 'd'));

create policy role_permissions_read on public.role_permissions for select to authenticated
  using (has_perm('permissions', 'v'));
create policy role_permissions_add on public.role_permissions for insert to authenticated
  with check (has_perm('permissions', 'e'));
create policy role_permissions_change on public.role_permissions for update to authenticated
  using (has_perm('permissions', 'e')) with check (has_perm('permissions', 'e'));
create policy role_permissions_remove on public.role_permissions for delete to authenticated
  using (has_perm('permissions', 'e'));

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or has_perm('users', 'v') or has_perm('members', 'v'));
create policy profiles_add on public.profiles for insert to authenticated
  with check (has_perm('users', 'c'));
create policy profiles_change on public.profiles for update to authenticated
  using (id = auth.uid() or has_perm('users', 'e') or has_perm('members', 'e'))
  with check (id = auth.uid() or has_perm('users', 'e') or has_perm('members', 'e'));
-- Mazání je měkké (deleted_at); tvrdé smazání jen pro správu účtů s právem mazat.
create policy profiles_remove on public.profiles for delete to authenticated
  using (has_perm('users', 'd') and id <> auth.uid());

create policy approver_countries_read on public.approver_countries for select to authenticated
  using (user_id = auth.uid() or has_perm('users', 'v'));
create policy approver_countries_write on public.approver_countries for all to authenticated
  using (has_perm('users', 'e')) with check (has_perm('users', 'e'));

create policy approver_authors_read on public.approver_authors for select to authenticated
  using (user_id = auth.uid() or has_perm('users', 'v'));
create policy approver_authors_write on public.approver_authors for all to authenticated
  using (has_perm('users', 'e')) with check (has_perm('users', 'e'));

create policy allowed_emails_read on public.allowed_emails for select to authenticated
  using (has_perm('users', 'v'));
create policy allowed_emails_write on public.allowed_emails for all to authenticated
  using (has_perm('users', 'e')) with check (has_perm('users', 'e'));

create policy security_settings_read on public.security_settings for select to authenticated
  using (has_perm('permissions', 'v'));
create policy security_settings_change on public.security_settings for update to authenticated
  using (has_perm('permissions', 'e')) with check (has_perm('permissions', 'e'));

-- Záznam změn se jen čte; zapisují do něj výhradně triggery.
create policy audit_log_read on public.audit_log for select to authenticated
  using (has_perm('permissions', 'v'));

-- ---------------------------------------------------------------------------
-- Přístupová práva k objektům (RLS pak rozhoduje o řádcích)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.roles, public.role_permissions, public.profiles, public.approver_countries,
  public.approver_authors, public.allowed_emails, public.security_settings, public.audit_log
  to authenticated;
grant insert, update, delete on public.roles, public.role_permissions, public.profiles,
  public.approver_countries, public.approver_authors, public.allowed_emails to authenticated;
grant update on public.security_settings to authenticated;

revoke execute on function public.write_audit(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_row() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_active(), public.is_admin(), public.has_perm(text, text),
  public.my_role(), public.my_permissions() to authenticated;
