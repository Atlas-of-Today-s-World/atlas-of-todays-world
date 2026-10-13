-- =============================================================================
-- Operations: maintenance message, switch notes in English, editable redirects
-- =============================================================================
--
-- 1. site_notices — one row with the maintenance notice the public site shows
--    while the `maintenance` switch is on. The message is site content
--    (section `site`, "e"); turning maintenance on/off stays a `permissions`
--    "e" right on feature_flags (owner decision: switches are security).
--    Empty text = the site falls back to its built-in wording (en.json).
-- 2. feature_flags.note — the seeded notes were Czech; the admin is English.
--    Each is translated only while it still reads exactly as seeded, so a note
--    someone already rewrote is kept.
-- 3. redirects — editing an existing redirect (until now: delete and add again).
--    Who may: `news` "e" (the section that owns redirects today) or `site` "e".
--    The loop guard now also runs on UPDATE and skips the row being changed
--    (its old version is about to disappear); the author/creation time can't
--    be rewritten; `updated_at` is stamped; updates are audited.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. site_notices
-- ---------------------------------------------------------------------------

create table public.site_notices (
  id                 integer primary key default 1 check (id = 1),
  maintenance_title  text not null default '' check (length(maintenance_title) <= 120),
  maintenance_text   text not null default '' check (length(maintenance_text) <= 600),
  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);
create index site_notices_updated_by on public.site_notices (updated_by);

comment on table public.site_notices is
  'Site-wide notices (one row). Maintenance title/text shown while feature_flags.maintenance is on; empty = built-in text.';

insert into public.site_notices default values;

-- Same stamp as feature_flags: when and by whom (null for the service key).
create trigger site_notices_stamp before update on public.site_notices
  for each row execute function public.stamp_feature_flag();
create trigger site_notices_audit after update on public.site_notices
  for each row execute function public.audit_row('id');

alter table public.site_notices enable row level security;

create policy site_notices_public on public.site_notices for select to anon
  using (true);
create policy site_notices_read on public.site_notices for select to authenticated
  using (true);
create policy site_notices_change on public.site_notices for update to authenticated
  using ((select public.has_perm('site', 'e')))
  with check ((select public.has_perm('site', 'e')));
-- No insert/delete policy: the single row comes from this migration.

revoke all on public.site_notices from anon, authenticated;
grant select (maintenance_title, maintenance_text) on public.site_notices to anon;
grant select on public.site_notices to authenticated;
grant update (maintenance_title, maintenance_text) on public.site_notices to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Switch notes in English (only where still the seeded Czech text)
-- ---------------------------------------------------------------------------

update public.feature_flags
   set note = 'The public site shows a maintenance notice; the admin and sign-in keep working.'
 where key = 'maintenance'
   and note = 'Veřejný web ukáže oznámení o údržbě; administrace a přihlášení běží dál.';

update public.feature_flags
   set note = 'Newsletter sign-up form in the menu.'
 where key = 'newsletter'
   and note = 'Formulář pro odběr novinek v menu.';

update public.feature_flags
   set note = 'Sign-in with an emailed code and invitations by email. Turn on only with our own SMTP (U5).'
 where key = 'email_auth'
   and note = 'Přihlášení kódem z e-mailu a pozvánky e-mailem. Zapnout až s vlastním SMTP (U5).';

-- ---------------------------------------------------------------------------
-- 3. Editable redirects
-- ---------------------------------------------------------------------------

alter table public.redirects
  add column updated_at timestamptz not null default now();

-- Author and creation time are set by the database: on INSERT from the caller,
-- on UPDATE kept as they were. On both, the target must not lead back to the
-- source (a → b → … → a). The walk skips this row's stored version: after an
-- UPDATE only the new from_path → to_path exists.
create or replace function public.guard_redirects()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  hop text := split_part(split_part(new.to_path, '#', 1), '?', 1);
  steps integer := 0;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  while hop is not null and steps < 50 loop
    if hop = new.from_path then
      raise exception 'This redirect would loop back to where it starts.' using errcode = '22023';
    end if;
    select split_part(split_part(r.to_path, '#', 1), '?', 1) into hop
      from redirects r where r.from_path = hop and r.id <> new.id;
    if not found then
      hop := null;
    end if;
    steps := steps + 1;
  end loop;
  return new;
end;
$$;
revoke execute on function public.guard_redirects() from public, anon, authenticated;

drop trigger redirects_guard on public.redirects;
create trigger redirects_guard before insert or update on public.redirects
  for each row execute function public.guard_redirects();

drop trigger redirects_audit on public.redirects;
create trigger redirects_audit after insert or update or delete on public.redirects
  for each row execute function public.audit_row('from_path');

create policy redirects_change on public.redirects for update to authenticated
  using ((select public.has_perm('news', 'e')) or (select public.has_perm('site', 'e')))
  with check ((select public.has_perm('news', 'e')) or (select public.has_perm('site', 'e')));

grant update (from_path, to_path, permanent) on public.redirects to authenticated;
