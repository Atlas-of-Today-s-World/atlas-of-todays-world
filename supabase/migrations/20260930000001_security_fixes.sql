-- =============================================================================
-- Bezpečnostní opravy schématu po review (ARCHITEKTURA 6.2, PLAN B1)
-- =============================================================================
--
-- 1. Ochranné triggery, které čtou tabulky chráněné RLS, běží jako vlastník
--    (security definer). Pod právy volajícího by dostaly prázdný výsledek
--    a kontrolu by tiše přeskočily (např. seznam povolených e-mailů).
-- 2. Zápisové politiky zvlášť pro INSERT / UPDATE / DELETE — mazání chce
--    právo „d", ne jen „e".
-- 3. URL sloupce jen https (žádné javascript: přes přímý zápis do API).
-- 4. Anonym nevidí interní sloupce (vlastník, poznámka recenzenta, schvalovatel).
-- 5. Schvalování: jen z „pending", nikdo neschvaluje sám sebe (kromě admina),
--    do „pending" jen přes submit_entry().
-- 6. Pomocné funkce oprávnění nejsou k volání pro anonyma.
-- 7. Záznam změn bez osobních údajů.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ochranné triggery jako security definer
-- ---------------------------------------------------------------------------

alter function public.guard_roles() security definer;
alter function public.guard_role_permissions() security definer;
alter function public.keep_one_admin() security definer;
alter function public.guard_memberships() security definer;

-- Interní povolení změny profilu pro jednu transakci. Zapisují ho jen
-- security definer funkce (přijetí pozvánky); klient k tabulce nemá práva.
create table public.internal_profile_grants (
  tx       bigint not null default txid_current(),
  user_id  uuid not null,
  primary key (tx, user_id)
);
alter table public.internal_profile_grants enable row level security;
revoke all on public.internal_profile_grants from public, anon, authenticated;

-- guard_profiles: security definer + oprava větve „správce členství upravuje
-- sám sebe" (dřív skončil chybou a spadl mu i záznam návštěvy).
create or replace function public.guard_profiles()
returns trigger
language plpgsql security definer
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
  if me is null
     or exists (select 1 from internal_profile_grants g where g.tx = txid_current() and g.user_id = new.id) then
    return new;  -- servisní klíč (registrace, importy, webhooky) nebo přijetí pozvánky
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
      if me = old.id then
        if (new.email, new.role_id, new.kind, new.status, new.blocked_note, new.approval_global, new.deleted_at)
           is distinct from
           (old.email, old.role_id, old.kind, old.status, old.blocked_note, old.approval_global, old.deleted_at) then
          raise exception 'You can change only your own name and phone.' using errcode = '42501';
        end if;
      elsif may_members then
        if (new.email, new.name, new.phone, new.role_id, new.kind, new.approval_global, new.deleted_at)
           is distinct from
           (old.email, old.name, old.phone, old.role_id, old.kind, old.approval_global, old.deleted_at) then
          raise exception 'Membership managers can only block or unblock an account.' using errcode = '42501';
        end if;
      else
        raise exception 'Your role cannot change accounts.' using errcode = '42501';
      end if;
    end if;

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

  select * into new_role from roles where id = new.role_id;
  if new_role.locked and role_changed and not is_admin() then
    raise exception 'Only an admin can give the admin role.' using errcode = '42501';
  end if;

  select * into settings from security_settings where id = 1;
  if coalesce(settings.invite_only, true) and became_staff
     and exists (select 1 from allowed_emails)
     and not exists (
       select 1 from allowed_emails a
       where a.value = lower(new.email)
          or (left(a.value, 1) = '@' and lower(new.email) like '%' || a.value)) then
    raise exception 'This address is not on the allowed e-mails list.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profiles(), public.guard_roles(), public.guard_role_permissions(),
  public.keep_one_admin(), public.guard_memberships() from public, anon, authenticated;

-- Placené členství nesmí zmizet ani ručně (rozjelo by se se Stripe).
create or replace function public.guard_memberships()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);  -- webhook servisním klíčem
  end if;
  if not is_admin() then
    raise exception 'Only an admin can grant a membership by hand.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    if not old.complimentary or old.stripe_subscription_id is not null then
      raise exception 'Paid memberships are managed by the payment provider.' using errcode = '42501';
    end if;
    return old;
  end if;
  if not new.complimentary or new.stripe_subscription_id is not null
     or new.stripe_customer_id is distinct from (case when tg_op = 'UPDATE' then old.stripe_customer_id end) then
    raise exception 'Paid memberships are managed by the payment provider.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Zápisové politiky zvlášť pro každý příkaz
-- ---------------------------------------------------------------------------

-- Přiřazení schvalovatelů a povolené e-maily
drop policy approver_countries_write on public.approver_countries;
create policy approver_countries_add on public.approver_countries for insert to authenticated
  with check (has_perm('users', 'e'));
create policy approver_countries_remove on public.approver_countries for delete to authenticated
  using (has_perm('users', 'e'));

drop policy approver_authors_write on public.approver_authors;
create policy approver_authors_add on public.approver_authors for insert to authenticated
  with check (has_perm('users', 'e'));
create policy approver_authors_remove on public.approver_authors for delete to authenticated
  using (has_perm('users', 'e'));

drop policy allowed_emails_write on public.allowed_emails;
create policy allowed_emails_add on public.allowed_emails for insert to authenticated
  with check (has_perm('users', 'c'));
create policy allowed_emails_change on public.allowed_emails for update to authenticated
  using (has_perm('users', 'e')) with check (has_perm('users', 'e'));
create policy allowed_emails_remove on public.allowed_emails for delete to authenticated
  using (has_perm('users', 'd'));

drop policy role_permissions_remove on public.role_permissions;
create policy role_permissions_remove on public.role_permissions for delete to authenticated
  using (has_perm('permissions', 'd'));

-- Ukazatele
drop policy indicator_values_write on public.indicator_values;
create policy indicator_values_add on public.indicator_values for insert to authenticated
  with check (has_perm('regions', 'e') or has_perm('layers', 'e'));
create policy indicator_values_change on public.indicator_values for update to authenticated
  using (has_perm('regions', 'e') or has_perm('layers', 'e'))
  with check (has_perm('regions', 'e') or has_perm('layers', 'e'));
create policy indicator_values_remove on public.indicator_values for delete to authenticated
  using (has_perm('layers', 'd'));

drop policy indicator_categories_write on public.indicator_categories;
create policy indicator_categories_add on public.indicator_categories for insert to authenticated
  with check (has_perm('layers', 'e'));
create policy indicator_categories_change on public.indicator_categories for update to authenticated
  using (has_perm('layers', 'e')) with check (has_perm('layers', 'e'));
create policy indicator_categories_remove on public.indicator_categories for delete to authenticated
  using (has_perm('layers', 'd'));

drop policy indicator_styles_write on public.indicator_styles;
create policy indicator_styles_add on public.indicator_styles for insert to authenticated
  with check (has_perm('layers', 'e'));
create policy indicator_styles_change on public.indicator_styles for update to authenticated
  using (has_perm('layers', 'e')) with check (has_perm('layers', 'e'));
create policy indicator_styles_remove on public.indicator_styles for delete to authenticated
  using (has_perm('layers', 'd'));

-- Složení global issue (země patří k úpravě celku, proto „e"; při zakládání „c")
drop policy special_region_countries_write on public.special_region_countries;
create policy special_region_countries_add on public.special_region_countries for insert to authenticated
  with check (has_perm('specials', 'c') or has_perm('specials', 'e'));
create policy special_region_countries_remove on public.special_region_countries for delete to authenticated
  using (has_perm('specials', 'e'));

-- Ruční karty ukazatelů portrétu
drop policy portrait_metrics_write on public.portrait_metrics;
create policy portrait_metrics_add on public.portrait_metrics for insert to authenticated
  with check (has_perm('regions', 'e'));
create policy portrait_metrics_change on public.portrait_metrics for update to authenticated
  using (has_perm('regions', 'e')) with check (has_perm('regions', 'e'));
create policy portrait_metrics_remove on public.portrait_metrics for delete to authenticated
  using (has_perm('regions', 'd'));

-- Autoři: nový profil autora zakládá, kdo píše; cizí bio upravuje jen redakce
-- s přístupem ke všem článkům, své bio autor (DB-04).
drop policy authors_write on public.authors;
create policy authors_add on public.authors for insert to authenticated
  with check (has_perm('news', 'c'));
create policy authors_change on public.authors for update to authenticated
  using (has_perm('news', 'e') and (profile_id = auth.uid() or can_edit_entry(null)))
  with check (has_perm('news', 'e') and (profile_id = auth.uid() or can_edit_entry(null)));
create policy authors_remove on public.authors for delete to authenticated
  using (has_perm('news', 'd') and can_edit_entry(null));

-- Vazby a kapitoly článku
drop policy entry_countries_write on public.entry_countries;
create policy entry_countries_add on public.entry_countries for insert to authenticated
  with check (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                      and (e.status = 'draft' or e.status = 'planned' or can_approve_entry(e.id))));
create policy entry_countries_remove on public.entry_countries for delete to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                 and (e.status = 'draft' or e.status = 'planned' or can_approve_entry(e.id))));

drop policy entry_chapters_write on public.entry_chapters;
create policy entry_chapters_add on public.entry_chapters for insert to authenticated
  with check (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                      and (e.status <> 'published' or can_approve_entry(e.id))));
create policy entry_chapters_change on public.entry_chapters for update to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                 and (e.status <> 'published' or can_approve_entry(e.id))))
  with check (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                      and (e.status <> 'published' or can_approve_entry(e.id))));
create policy entry_chapters_remove on public.entry_chapters for delete to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                 and (e.status <> 'published' or can_approve_entry(e.id))));

-- Obsah portrétů: mazání chce „d"
drop policy timeline_write on public.timeline_events;
create policy timeline_add on public.timeline_events for insert to authenticated
  with check (has_perm('news', 'e') and can_edit_entry(null));
create policy timeline_change on public.timeline_events for update to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));
create policy timeline_remove on public.timeline_events for delete to authenticated
  using (has_perm('news', 'd') and can_edit_entry(null));

drop policy faq_write on public.faq_items;
create policy faq_add on public.faq_items for insert to authenticated
  with check (has_perm('news', 'e') and can_edit_entry(null));
create policy faq_change on public.faq_items for update to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));
create policy faq_remove on public.faq_items for delete to authenticated
  using (has_perm('news', 'd') and can_edit_entry(null));

drop policy visual_embeds_write on public.visual_embeds;
create policy visual_embeds_add on public.visual_embeds for insert to authenticated
  with check (has_perm('news', 'e') and can_edit_entry(null));
create policy visual_embeds_change on public.visual_embeds for update to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));
create policy visual_embeds_remove on public.visual_embeds for delete to authenticated
  using (has_perm('news', 'd') and can_edit_entry(null));

-- Zdroje: u zdroje hesla rozhoduje heslo (DB-05) — veřejné jen u zveřejněného.
drop policy resources_public on public.resources;
drop policy resources_write on public.resources;
create policy resources_public on public.resources for select to anon
  using (entry_id is null
         or exists (select 1 from entries e where e.id = entry_id and e.status = 'published'));
create policy resources_read on public.resources for select to authenticated
  using (entry_id is null
         or exists (select 1 from entries e where e.id = entry_id
                    and (e.status = 'published' or can_read_unpublished(e.owner_id))));
create policy resources_add on public.resources for insert to authenticated
  with check (case when entry_id is null then has_perm('news', 'e') and can_edit_entry(null)
                   else exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                                and (e.status <> 'published' or can_approve_entry(e.id))) end);
create policy resources_change on public.resources for update to authenticated
  using (case when entry_id is null then has_perm('news', 'e') and can_edit_entry(null)
              else exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                           and (e.status <> 'published' or can_approve_entry(e.id))) end)
  with check (case when entry_id is null then has_perm('news', 'e') and can_edit_entry(null)
                   else exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                                and (e.status <> 'published' or can_approve_entry(e.id))) end);
create policy resources_remove on public.resources for delete to authenticated
  using (case when entry_id is null then has_perm('news', 'd') and can_edit_entry(null)
              else exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                           and (e.status <> 'published' or can_approve_entry(e.id))) end);

-- Členství: ručně jen bezplatné, a smazat jen bezplatné
drop policy memberships_write on public.memberships;
create policy memberships_add on public.memberships for insert to authenticated
  with check (is_admin() and complimentary);
create policy memberships_change on public.memberships for update to authenticated
  using (is_admin()) with check (is_admin() and complimentary);
create policy memberships_remove on public.memberships for delete to authenticated
  using (is_admin() and complimentary and stripe_subscription_id is null);

-- Admin smí založit článek za jiného autora (guard_entries to už dovoluje).
drop policy entries_add on public.entries;
create policy entries_add on public.entries for insert to authenticated
  with check (has_perm('news', 'c') and (owner_id = auth.uid() or is_admin())
              and status in ('draft', 'planned'));

-- ---------------------------------------------------------------------------
-- 3. URL sloupce jen https (DB-06)
-- ---------------------------------------------------------------------------

alter table public.entries add constraint entries_cover_url_https
  check (cover_url is null or cover_url ~ '^https://');
alter table public.authors add constraint authors_photo_url_https
  check (photo_url is null or photo_url ~ '^https://');
alter table public.entry_chapters add constraint entry_chapters_illustration_url_https
  check (illustration_url is null or illustration_url ~ '^https://');
alter table public.timeline_events add constraint timeline_events_image_url_https
  check (image_url is null or image_url ~ '^https://');
alter table public.resources add constraint resources_image_url_https
  check (image_url is null or image_url ~ '^https://');
alter table public.indicators add constraint indicators_source_url_https
  check (source_url is null or source_url ~ '^https://');
alter table public.map_areas add constraint map_areas_note_length check (length(note) <= 1000);

-- ---------------------------------------------------------------------------
-- 4. Anonym nevidí interní sloupce (DB-08)
-- ---------------------------------------------------------------------------
-- Sloupcová práva: veřejný web se ptá na vyjmenované sloupce, nikdy `select *`.

revoke select on public.entries from anon;
grant select (id, slug, kind, locale, title, summary, category, region_slug, special_slug, area_id,
  cover_url, cover_credit, body_html, author_name, author_id, status, published_on, reading_minutes,
  created_at, updated_at) on public.entries to anon;

revoke select on public.authors from anon;
grant select (id, name, photo_url, bio, positionality, created_at) on public.authors to anon;

-- ---------------------------------------------------------------------------
-- 5. Schvalování (DB-09)
-- ---------------------------------------------------------------------------

-- Nikdo kromě admina neschvaluje vlastní článek — ani globální schvalovatel.
create or replace function public.can_approve_entry(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when not is_active() then false
    when is_admin() then true
    when not has_perm('approvals', 'e') then false
    when (select e.owner_id = auth.uid() from entries e where e.id = p_entry) then false
    else coalesce((
      select case r.approval_scope
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
      from profiles p join roles r on r.id = p.role_id
      where p.id = auth.uid()), false)
  end;
$$;

create or replace function public.approve_entry(p_entry uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not can_approve_entry(p_entry) then
    raise exception 'This entry is outside what you may approve.' using errcode = '42501';
  end if;
  update entries
     set status = 'published',
         approved_by = auth.uid(),
         approved_at = now(),
         published_on = coalesce(published_on, current_date),
         review_note = null
   where id = p_entry and status = 'pending';
  if not found then
    raise exception 'Only an entry waiting for approval can be approved.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.unpublish_entry(p_entry uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not can_approve_entry(p_entry) then
    raise exception 'Only someone who may approve an entry can take it down.' using errcode = '42501';
  end if;
  update entries set status = 'draft', approved_by = null, approved_at = null, review_note = null
  where id = p_entry and status = 'published';
  if not found then
    raise exception 'Only a published entry can be taken down.' using errcode = '22023';
  end if;
end;
$$;

-- Do „pending" jen přes submit_entry(); autor si stav nepřepíše přímým zápisem.
create or replace function public.guard_entries()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- Uvnitř security definer funkce je current_user její vlastník; přímý
  -- dotaz z aplikace běží jako `authenticated` a to si klient nezmění.
  approving boolean := current_user not in ('authenticated', 'anon');
begin
  new.updated_at := now();
  if auth.uid() is null then
    return new;  -- import a servisní klíč
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('published', 'pending') and not approving then
      raise exception 'A new entry starts as a draft; it goes out through approval.' using errcode = '42501';
    end if;
    if new.owner_id is distinct from auth.uid() and not is_admin() then
      raise exception 'New entries belong to whoever writes them.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and not approving
     and not (old.status in ('draft', 'planned') and new.status in ('draft', 'planned')) then
    raise exception 'The status changes through submit, approve, send back or take down.' using errcode = '42501';
  end if;
  if old.status = 'published' and not approving and not can_approve_entry(old.id) then
    raise exception 'A published entry is changed by someone who may also approve it.' using errcode = '42501';
  end if;
  if new.owner_id is distinct from old.owner_id and not is_admin() then
    raise exception 'Only an admin can hand an entry to another author.' using errcode = '42501';
  end if;
  if (new.approved_by, new.approved_at) is distinct from (old.approved_by, old.approved_at) and not approving then
    raise exception 'Approval is recorded by the approval itself.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Importovaný ukazatel se nedá přepnout na vlastní a pak smazat (DB-10).
create or replace function public.guard_indicators()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.is_custom is distinct from old.is_custom then
    raise exception 'Whether an indicator is custom is fixed when it is created.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_indicators() from public, anon, authenticated;

create trigger indicators_guard
  before update on public.indicators
  for each row execute function public.guard_indicators();

-- ---------------------------------------------------------------------------
-- 6. Pomocné funkce nejsou pro anonyma (DB-13)
-- ---------------------------------------------------------------------------

create or replace function public.has_perm(p_section text, p_action text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_action in ('v', 'c', 'e', 'd') and exists (
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

revoke execute on function public.is_active(), public.is_admin(), public.has_perm(text, text),
  public.my_role(), public.my_permissions(), public.can_edit_entry(uuid),
  public.can_read_unpublished(uuid), public.can_approve_entry(uuid) from public, anon;
grant execute on function public.is_active(), public.is_admin(), public.has_perm(text, text),
  public.my_role(), public.my_permissions(), public.can_edit_entry(uuid),
  public.can_read_unpublished(uuid), public.can_approve_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Záznam změn bez osobních údajů (DB-14)
-- ---------------------------------------------------------------------------
-- Ukládá jen změněná pole a vynechává kontaktní údaje a platební identifikátory.
-- Cílem u profilů je id, ne e-mail.

create or replace function public.audit_row()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  key text := tg_argv[0];
  private text[] := array['email', 'phone', 'blocked_note', 'stripe_customer_id', 'stripe_subscription_id'];
  row_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - private end;
  row_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - private end;
  changed_old jsonb := '{}'::jsonb;
  changed_new jsonb := '{}'::jsonb;
  field text;
begin
  if tg_op = 'UPDATE' then
    for field in select jsonb_object_keys(row_new) loop
      if row_new -> field is distinct from row_old -> field then
        changed_old := changed_old || jsonb_build_object(field, row_old -> field);
        changed_new := changed_new || jsonb_build_object(field, row_new -> field);
      end if;
    end loop;
    row_old := changed_old;
    row_new := changed_new;
  end if;
  perform write_audit(
    tg_table_name || '.' || lower(tg_op),
    coalesce(to_jsonb(new) ->> key, to_jsonb(old) ->> key),
    jsonb_strip_nulls(jsonb_build_object('old', row_old, 'new', row_new)));
  return coalesce(new, old);
end;
$$;

-- Záznam u profilu identifikuje účet id, ne e-mailem.
drop trigger profiles_audit on public.profiles;
create trigger profiles_audit
  after update on public.profiles
  for each row
  when (old.role_id is distinct from new.role_id
     or old.status is distinct from new.status
     or old.kind is distinct from new.kind
     or old.approval_global is distinct from new.approval_global
     or old.deleted_at is distinct from new.deleted_at)
  execute function public.audit_row('id');

-- write_audit si dřív do záznamu kopírovalo e-mail aktéra; stačí jeho id.
create or replace function public.write_audit(p_action text, p_target text, p_detail jsonb default '{}'::jsonb)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into audit_log (actor, action, target, detail)
  values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
$$;
revoke execute on function public.write_audit(text, text, jsonb) from public, anon, authenticated;

-- Retence: záznamy starší 12 měsíců (volá plánovaná úloha se servisním klíčem).
create or replace function public.purge_audit_log()
returns integer
language sql security definer
set search_path = public, pg_temp
as $$
  with gone as (delete from audit_log where at < now() - interval '12 months' returning 1)
  select count(*)::integer from gone;
$$;
revoke execute on function public.purge_audit_log() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Úložiště obrázků: vlastník podle owner_id a soubor ve vlastní složce (DB-16)
-- ---------------------------------------------------------------------------

drop policy entry_images_upload on storage.objects;
drop policy entry_images_change on storage.objects;
drop policy entry_images_remove on storage.objects;

create policy entry_images_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-images'
              and public.has_perm('news', 'c')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy entry_images_change on storage.objects for update to authenticated
  using (bucket_id = 'entry-images' and (owner_id = auth.uid()::text or public.can_edit_entry(null)))
  with check (bucket_id = 'entry-images' and (owner_id = auth.uid()::text or public.can_edit_entry(null)));
create policy entry_images_remove on storage.objects for delete to authenticated
  using (bucket_id = 'entry-images' and (owner_id = auth.uid()::text or public.can_edit_entry(null)));
