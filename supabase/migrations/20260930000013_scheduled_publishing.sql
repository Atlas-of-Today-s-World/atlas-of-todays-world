-- =============================================================================
-- Plánované publikování článků (PLAN G3)
-- =============================================================================
--
-- Schvalovatel místo „Schválit a zveřejnit" zvolí čas. Článek zůstane ve stavu
-- `pending` s vyplněným `publish_at`; v daný čas ho zveřejní databáze sama
-- (pg_cron každých 5 minut volá `publish_due_entries()`).
--
-- Pravidla jsou stejná jako u `approve_entry()`:
--   * naplánovat i zrušit plán smí jen ten, kdo smí článek schválit
--     (`schedule_entry` / `unschedule_entry`, security definer),
--   * `publish_at` a `scheduled_by` klient přímo nezapíše (trigger),
--   * v čase zveřejnění se znovu ověří, že ten, kdo plánoval, článek pořád
--     smí schválit (účet aktivní, role s právem, rozsah) — jinak se plán zruší,
--   * když článek mezitím změní někdo jiný než ten, kdo plánoval, plán se
--     zruší: schválený text nesmí na web odejít s cizí úpravou bez druhých očí,
--   * když článek opustí stav `pending` (schválen hned, vrácen), plán zaniká.
--
-- Proč pg_cron a ne Vercel Cron: Vercel Hobby spouští cron jen jednou denně a
-- route by potřebovala servisní klíč a další tajemství (CRON_SECRET). pg_cron
-- běží uvnitř DB, nepotřebuje žádný klíč mimo databázi a stav mění jen tahle
-- funkce. Veřejné stránky mají revalidaci ≤ 1 h (PUBLIC_REVALIDATE_SECONDS),
-- takže se naplánovaný článek na webu objeví nejpozději hodinu po svém čase.
--
-- PGlite (DB testy) pg_cron nemá: zapnutí rozšíření a naplánování úlohy je
-- v bloku, který se bez dostupného pg_cron přeskočí. Funkci testy volají přímo.
-- =============================================================================

alter table public.entries
  add column publish_at   timestamptz,
  add column scheduled_by uuid references public.profiles (id) on delete set null;

create index entries_scheduled_by on public.entries (scheduled_by);
create index entries_publish_due on public.entries (publish_at)
  where status = 'pending' and publish_at is not null;

comment on column public.entries.publish_at is
  'Kdy článek ve stavu pending zveřejní publish_due_entries(); mění jen schedule_entry/unschedule_entry.';
comment on column public.entries.scheduled_by is
  'Kdo zveřejnění naplánoval; v čase zveřejnění se ověří, že článek pořád smí schválit.';

-- ---------------------------------------------------------------------------
-- Smí uživatel schválit článek? (jedno pravidlo pro session i pro cron)
-- ---------------------------------------------------------------------------
-- Tělo dřívějšího can_approve_entry() vytažené pro libovolného uživatele, aby
-- ho mohl použít i cron, který žádnou session nemá. Druhý faktor (aal2) se
-- ověřuje jen v can_approve_entry() — z cronu není co ověřit, ověřil se při
-- naplánování. Jen pro interní použití, aplikace ho volat nesmí.

create or replace function public.may_approve_entry_as(p_user uuid, p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when r.locked then true
      when strpos(coalesce(rp.actions, ''), 'e') = 0 then false
      when (select e.owner_id = p.id from entries e where e.id = p_entry) then false
      else case r.approval_scope
        when 'global' then true
        when 'assigned' then
          p.approval_global
          or exists (
            select 1 from approver_authors aa
            join entries e on e.owner_id = aa.author_id
            where aa.user_id = p.id and e.id = p_entry)
          or exists (
            select 1 from approver_countries ac
            join entry_countries ec on ec.country_iso3 = ac.country_iso3
            where ac.user_id = p.id and ec.entry_id = p_entry)
        else false
      end
    end
    from profiles p
    join roles r on r.id = p.role_id
    left join role_permissions rp on rp.role_id = r.id and rp.section = 'approvals'
    where p.id = p_user and p.status = 'active' and p.deleted_at is null), false);
$$;
revoke execute on function public.may_approve_entry_as(uuid, uuid) from public, anon, authenticated;

-- Stejné pravidlo jako dosud (migrace 20260930000001 + 2FA z 20260930000011),
-- jen bez druhé kopie logiky.
create or replace function public.can_approve_entry(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and mfa_ok() and may_approve_entry_as(auth.uid(), p_entry);
$$;

-- ---------------------------------------------------------------------------
-- Naplánovat / zrušit plán
-- ---------------------------------------------------------------------------

create or replace function public.schedule_entry(p_entry uuid, p_at timestamptz)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not can_approve_entry(p_entry) then
    raise exception 'This entry is outside what you may approve.' using errcode = '42501';
  end if;
  if p_at is null or p_at < now() + interval '5 minutes' or p_at > now() + interval '1 year' then
    raise exception 'Pick a time at least 5 minutes ahead and within a year.' using errcode = '22023';
  end if;
  update entries set publish_at = p_at, scheduled_by = auth.uid()
  where id = p_entry and status = 'pending';
  if not found then
    raise exception 'Only an entry waiting for approval can be scheduled.' using errcode = '22023';
  end if;
  perform write_audit('entries.schedule', (select slug from entries where id = p_entry),
    jsonb_build_object('publish_at', p_at));
end;
$$;

create or replace function public.unschedule_entry(p_entry uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not can_approve_entry(p_entry) then
    raise exception 'This entry is outside what you may approve.' using errcode = '42501';
  end if;
  update entries set publish_at = null, scheduled_by = null
  where id = p_entry and status = 'pending' and publish_at is not null;
  if not found then
    raise exception 'This entry has no scheduled publication.' using errcode = '22023';
  end if;
  perform write_audit('entries.unschedule', (select slug from entries where id = p_entry), '{}'::jsonb);
end;
$$;

revoke execute on function public.schedule_entry(uuid, timestamptz), public.unschedule_entry(uuid)
  from public, anon;
grant execute on function public.schedule_entry(uuid, timestamptz), public.unschedule_entry(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Ochrana plánu
-- ---------------------------------------------------------------------------

-- Záměrně BEZ security definer: rozlišuje volání z ověřené funkce podle
-- current_user (jako guard_entries) a žádnou tabulku pod RLS nečte.
create or replace function public.guard_entry_schedule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- Stejný test jako guard_entries(): uvnitř security definer funkce
  -- (schedule_entry, approve_entry…) je current_user vlastník funkce.
  trusted boolean := auth.uid() is null or current_user not in ('authenticated', 'anon');
  workflow text[] := array['updated_at', 'publish_at', 'scheduled_by', 'status', 'review_note',
                           'approved_by', 'approved_at', 'published_on', 'search'];
begin
  if tg_op = 'INSERT' then
    if (new.publish_at is not null or new.scheduled_by is not null) and not trusted then
      raise exception 'Publication is scheduled through schedule_entry().' using errcode = '42501';
    end if;
  else
    if (new.publish_at, new.scheduled_by) is distinct from (old.publish_at, old.scheduled_by)
       and not trusted then
      raise exception 'Publication is scheduled through schedule_entry().' using errcode = '42501';
    end if;
    -- Změna obsahu někým jiným než tím, kdo plánoval → plán zaniká.
    if old.publish_at is not null and not trusted
       and auth.uid() is distinct from old.scheduled_by
       and (to_jsonb(new) - workflow) is distinct from (to_jsonb(old) - workflow) then
      new.publish_at := null;
      new.scheduled_by := null;
    end if;
  end if;
  -- Plán patří jen čekajícímu článku (schválen hned, vrácen, stažen → pryč).
  if new.status <> 'pending' then
    new.publish_at := null;
    new.scheduled_by := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_entry_schedule() from public, anon, authenticated;

create trigger entries_schedule_guard
  before insert or update on public.entries
  for each row execute function public.guard_entry_schedule();

-- ---------------------------------------------------------------------------
-- Zveřejnění v čase (volá pg_cron; aplikace ani klient ne)
-- ---------------------------------------------------------------------------

create or replace function public.publish_due_entries()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  due record;
  published integer := 0;
begin
  for due in
    select id, slug, scheduled_by, publish_at from entries
    where status = 'pending' and publish_at is not null and publish_at <= now()
    order by publish_at
    for update skip locked
  loop
    if due.scheduled_by is not null and may_approve_entry_as(due.scheduled_by, due.id) then
      update entries
         set status = 'published',
             approved_by = due.scheduled_by,
             approved_at = now(),
             published_on = coalesce(published_on, (due.publish_at at time zone 'UTC')::date),
             review_note = null
       where id = due.id;
      published := published + 1;
    else
      -- Ten, kdo plánoval, už článek schválit nesmí (role, blokace, přiřazení).
      update entries set publish_at = null, scheduled_by = null where id = due.id;
      perform write_audit('entries.schedule_dropped', due.slug,
        jsonb_build_object('publish_at', due.publish_at));
    end if;
  end loop;
  return published;
end;
$$;
revoke execute on function public.publish_due_entries() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron (Supabase). V PGlite rozšíření není → blok se přeskočí.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- cron.schedule se stejným názvem úlohu přepíše, opakované spuštění nevadí.
    execute $sql$select cron.schedule('publish-due-entries', '*/5 * * * *',
      'select public.publish_due_entries()')$sql$;
  else
    raise notice 'pg_cron není k dispozici (PGlite) — plánované publikování se nespouští samo.';
  end if;
end;
$$;
