-- =============================================================================
-- Články a hesla, jejich schvalování, historie a obsah portrétů
-- =============================================================================
--
-- Stavy článku: draft → pending → published (a planned pro hesla, která
-- teprve budou napsaná — šedivé dlaždice na portrétu).
--
-- Publikovat se dá JEN přes funkci `approve_entry()`, která ověří, že ten,
-- kdo schvaluje, na článek dosáhne (globálně, nebo přes přidělenou zemi či
-- autora). Přímý UPDATE na `status = 'published'` zastaví trigger — ať už ho
-- pošle kdokoli. Tím se pravidlo schvalování nedá obejít z aplikace.
--
-- Publikovaný článek smí přímo měnit jen ten, kdo ho smí i schválit.
-- Autor bez práva schvalovat svůj živý článek nepřepíše; změna zveřejněného
-- textu bez druhých očí je přesně to, čemu má schvalování bránit.
-- =============================================================================

create table public.authors (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid unique references public.profiles (id) on delete set null,
  name           text not null check (length(btrim(name)) between 1 and 120),
  photo_url      text,
  bio            text not null default '' check (length(bio) <= 2000),
  positionality  text not null default '' check (length(positionality) <= 2000),
  created_at     timestamptz not null default now()
);

create table public.entries (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  kind             text not null default 'news' check (kind in ('news', 'entry')),
  locale           text not null default 'en' check (locale ~ '^[a-z]{2}$'),
  title            text not null check (length(btrim(title)) between 1 and 200),
  summary          text not null default '' check (length(summary) <= 600),
  category         text not null check (category in (
                     'Living Conditions', 'Political System', 'Society',
                     'International Relations', 'Historical Roots')),
  region_slug      text references public.regions (slug) on update cascade,
  special_slug     text references public.special_regions (slug) on delete set null on update cascade,
  area_id          uuid references public.map_areas (id) on delete set null,
  cover_url        text check (length(cover_url) <= 1000),
  cover_credit     text check (length(cover_credit) <= 300),
  -- HTML z editoru, vyčištěné na serveru před uložením i před vykreslením.
  body_html        text not null default '' check (length(body_html) <= 400000),
  author_name      text check (length(author_name) <= 120),
  author_id        uuid references public.authors (id) on delete set null,
  owner_id         uuid references public.profiles (id) on delete set null,
  status           text not null default 'draft' check (status in ('draft', 'pending', 'published', 'planned')),
  published_on     date,
  reading_minutes  integer check (reading_minutes between 1 and 180),
  review_note      text check (length(review_note) <= 2000),
  approved_by      uuid references public.profiles (id) on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index entries_status on public.entries (status, published_on desc);
create index entries_region on public.entries (region_slug);
create index entries_special on public.entries (special_slug);
create index entries_area on public.entries (area_id);
create index entries_owner on public.entries (owner_id);

create table public.entry_countries (
  entry_id      uuid not null references public.entries (id) on delete cascade,
  country_iso3  text not null references public.countries (iso3) on delete cascade,
  primary key (entry_id, country_iso3)
);
create index entry_countries_country on public.entry_countries (country_iso3);

-- Kapitoly encyklopedického hesla (P9): 4–6 na heslo, každá se shrnutím.
create table public.entry_chapters (
  id                   uuid primary key default gen_random_uuid(),
  entry_id             uuid not null references public.entries (id) on delete cascade,
  position             integer not null,
  title                text not null check (length(btrim(title)) between 1 and 200),
  summary_points       text[] not null default '{}',
  body_html            text not null default '' check (length(body_html) <= 200000),
  illustration_url     text,
  illustration_credit  text,
  unique (entry_id, position)
);

-- Každé uložení textu si pamatuje předchozí podobu — redakce potřebuje „zpět".
create table public.entry_revisions (
  id        bigint generated always as identity primary key,
  entry_id  uuid not null references public.entries (id) on delete cascade,
  saved_by  uuid references public.profiles (id) on delete set null,
  saved_at  timestamptz not null default now(),
  snapshot  jsonb not null
);
create index entry_revisions_entry on public.entry_revisions (entry_id, saved_at desc);

-- ---------------------------------------------------------------------------
-- Obsah portrétů: region i vlastní celek sdílejí stejné sekce (P6/P8)
-- ---------------------------------------------------------------------------

create table public.timeline_events (
  id            uuid primary key default gen_random_uuid(),
  region_slug   text references public.regions (slug) on delete cascade on update cascade,
  special_slug  text references public.special_regions (slug) on delete cascade on update cascade,
  position      integer not null default 0,
  date_label    text not null,
  title         text not null,
  body          text not null default '',
  image_url     text,
  check ((region_slug is null) <> (special_slug is null))
);

create table public.faq_items (
  id            uuid primary key default gen_random_uuid(),
  region_slug   text references public.regions (slug) on delete cascade on update cascade,
  special_slug  text references public.special_regions (slug) on delete cascade on update cascade,
  position      integer not null default 0,
  question      text not null,
  answer        text not null,
  check ((region_slug is null) <> (special_slug is null))
);

create table public.resources (
  id            uuid primary key default gen_random_uuid(),
  region_slug   text references public.regions (slug) on delete cascade on update cascade,
  special_slug  text references public.special_regions (slug) on delete cascade on update cascade,
  entry_id      uuid references public.entries (id) on delete cascade,
  kind          text not null check (kind in (
                  'Videos & Documentaries', 'Lectures & Debates', 'Articles, Reports & Books',
                  'Educational Resources', 'Statistics & Infographics')),
  position      integer not null default 0,
  title         text not null,
  source        text not null default '',
  description   text not null default '',
  url           text not null check (url ~ '^https://'),
  image_url     text,
  check (num_nonnulls(region_slug, special_slug, entry_id) = 1)
);

-- Ruční karty ukazatelů portrétu („10+ etnických skupin", „6,9 mil. uprchlíků").
-- Na rozdíl od importovaných ukazatelů jsou to redakční čísla — a bez citace
-- se karta nepublikuje (P1), proto je zdroj povinný přímo v databázi.
create table public.portrait_metrics (
  id            uuid primary key default gen_random_uuid(),
  region_slug   text references public.regions (slug) on delete cascade on update cascade,
  special_slug  text references public.special_regions (slug) on delete cascade on update cascade,
  country_iso3  text references public.countries (iso3) on delete cascade,
  position      integer not null default 0,
  value         text not null check (length(btrim(value)) between 1 and 30),
  label         text not null check (length(btrim(label)) between 1 and 80),
  description   text not null default '' check (length(description) <= 600),
  source        text not null check (length(btrim(source)) between 1 and 200),
  source_url    text check (source_url ~ '^https://'),
  year          integer,
  check (num_nonnulls(region_slug, special_slug, country_iso3) = 1)
);

alter table public.regions add column timeline_title text, add column timeline_subtitle text;
alter table public.special_regions add column timeline_title text, add column timeline_subtitle text,
  add column intro text not null default '';

create table public.visual_embeds (
  id            uuid primary key default gen_random_uuid(),
  region_slug   text references public.regions (slug) on delete cascade on update cascade,
  special_slug  text references public.special_regions (slug) on delete cascade on update cascade,
  provider      text not null check (provider in ('flourish', 'worldbank', 'image')),
  position      integer not null default 0,
  title         text not null,
  caption       text not null default '',
  url           text not null check (url ~ '^https://'),
  check ((region_slug is null) <> (special_slug is null))
);

-- ---------------------------------------------------------------------------
-- Kdo na článek dosáhne
-- ---------------------------------------------------------------------------

-- Smí přihlášený upravovat článek s tímto vlastníkem?
create or replace function public.can_edit_entry(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when not is_active() then false
    when is_admin() then true
    when not has_perm('news', 'e') then false
    else coalesce((
      select case r.news_scope
               when 'all' then true
               when 'own' then p_owner = auth.uid()
               else false
             end
      from profiles p join roles r on r.id = p.role_id
      where p.id = auth.uid()), false)
  end;
$$;

-- Smí přihlášený vidět nezveřejněný článek s tímto vlastníkem?
create or replace function public.can_read_unpublished(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when not is_active() then false
    when is_admin() then true
    when p_owner = auth.uid() then true
    when has_perm('approvals', 'v') then true
    when has_perm('news', 'v') then coalesce((select r.news_scope <> 'own' from roles r
                                              join profiles p on p.role_id = r.id
                                              where p.id = auth.uid()), false)
    else false
  end;
$$;

-- Smí přihlášený tenhle článek schválit?
create or replace function public.can_approve_entry(p_entry uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when not is_active() then false
    when is_admin() then true
    when not has_perm('approvals', 'e') then false
    else coalesce((
      select case r.approval_scope
        when 'global' then true
        when 'assigned' then
          -- Přidělený schvalovatel nikdy neschvaluje sám sebe.
          (select e.owner_id is distinct from auth.uid() from entries e where e.id = p_entry)
          and (
            p.approval_global
            or exists (
              select 1 from approver_authors aa
              join entries e on e.owner_id = aa.author_id
              where aa.user_id = p.id and e.id = p_entry)
            or exists (
              select 1 from approver_countries ac
              join entry_countries ec on ec.country_iso3 = ac.country_iso3
              where ac.user_id = p.id and ec.entry_id = p_entry))
        else false
      end
      from profiles p join roles r on r.id = p.role_id
      where p.id = auth.uid()), false)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Ochrana stavů a historie
-- ---------------------------------------------------------------------------

create or replace function public.guard_entries()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  -- Změna přichází z ověřené funkce (approve_entry a spol.), ne z klienta?
  -- Uvnitř `security definer` funkce je current_user její vlastník; přímý
  -- dotaz z aplikace běží jako `authenticated` a to si klient nezmění.
  -- (Příznak přes set_config by si klient nastavit uměl — proto ne ten.)
  approving boolean := current_user not in ('authenticated', 'anon');
begin
  new.updated_at := now();
  if auth.uid() is null then
    return new;  -- import a servisní klíč
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'published' and not approving then
      raise exception 'An entry is published through approval, not by saving it.' using errcode = '42501';
    end if;
    if new.owner_id is distinct from auth.uid() and not is_admin() then
      raise exception 'New entries belong to whoever writes them.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'published' and old.status <> 'published' and not approving then
    raise exception 'An entry is published through approval, not by saving it.' using errcode = '42501';
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

create trigger entries_guard
  before insert or update on public.entries
  for each row execute function public.guard_entries();

create or replace function public.keep_entry_revision()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if (old.title, old.summary, old.body_html, old.cover_url)
     is distinct from (new.title, new.summary, new.body_html, new.cover_url) then
    insert into entry_revisions (entry_id, saved_by, snapshot)
    values (old.id, auth.uid(), to_jsonb(old));
  end if;
  return null;
end;
$$;

create trigger entries_revision
  after update on public.entries
  for each row execute function public.keep_entry_revision();

create trigger entries_status_audit
  after update on public.entries
  for each row when (old.status is distinct from new.status)
  execute function public.audit_row('slug');

create trigger entries_delete_audit
  after delete on public.entries
  for each row execute function public.audit_row('slug');

-- ---------------------------------------------------------------------------
-- Kroky schvalování (jediná cesta ke zveřejnění)
-- ---------------------------------------------------------------------------

create or replace function public.submit_entry(p_entry uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update entries set status = 'pending', review_note = null
  where id = p_entry and status = 'draft' and can_edit_entry(owner_id);
  if not found then
    raise exception 'Only a draft you may edit can be sent for approval.' using errcode = '42501';
  end if;
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
   where id = p_entry and status in ('draft', 'pending');
  if not found then
    raise exception 'Only a draft or a waiting entry can be approved.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.send_back_entry(p_entry uuid, p_note text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not can_approve_entry(p_entry) then
    raise exception 'This entry is outside what you may approve.' using errcode = '42501';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'Say what needs to change — the author reads this note.' using errcode = '22023';
  end if;
  update entries set status = 'draft', review_note = left(p_note, 2000)
  where id = p_entry and status = 'pending';
  if not found then
    raise exception 'Only a waiting entry can be sent back.' using errcode = '22023';
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
  update entries set status = 'draft' where id = p_entry and status = 'published';
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.authors enable row level security;
alter table public.entries enable row level security;
alter table public.entry_countries enable row level security;
alter table public.entry_chapters enable row level security;
alter table public.entry_revisions enable row level security;
alter table public.timeline_events enable row level security;
alter table public.faq_items enable row level security;
alter table public.resources enable row level security;
alter table public.visual_embeds enable row level security;
alter table public.portrait_metrics enable row level security;

create policy portrait_metrics_public on public.portrait_metrics for select to anon, authenticated using (true);
create policy portrait_metrics_write on public.portrait_metrics for all to authenticated
  using (has_perm('regions', 'e')) with check (has_perm('regions', 'e'));

create policy authors_public on public.authors for select to anon, authenticated using (true);
create policy authors_write on public.authors for all to authenticated
  using (has_perm('news', 'e')) with check (has_perm('news', 'e'));

-- Čtenář vidí jen zveřejněné; redakce navíc to, na co jí role dosáhne.
create policy entries_public on public.entries for select to anon
  using (status = 'published');
create policy entries_read on public.entries for select to authenticated
  using (status = 'published' or can_read_unpublished(owner_id));

create policy entries_add on public.entries for insert to authenticated
  with check (has_perm('news', 'c') and owner_id = auth.uid() and status in ('draft', 'pending', 'planned'));
create policy entries_change on public.entries for update to authenticated
  using (can_edit_entry(owner_id)) with check (can_edit_entry(owner_id));
create policy entries_remove on public.entries for delete to authenticated
  using (has_perm('news', 'd') and can_edit_entry(owner_id) and (status <> 'published' or is_admin()));

-- Vazby a kapitoly následují článek, ke kterému patří.
create policy entry_countries_public on public.entry_countries for select to anon
  using (exists (select 1 from entries e where e.id = entry_id and e.status = 'published'));
create policy entry_countries_read on public.entry_countries for select to authenticated
  using (exists (select 1 from entries e where e.id = entry_id
                 and (e.status = 'published' or can_read_unpublished(e.owner_id))));
create policy entry_countries_write on public.entry_countries for all to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                 and (e.status <> 'published' or can_approve_entry(e.id))))
  with check (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                      and (e.status <> 'published' or can_approve_entry(e.id))));

create policy entry_chapters_public on public.entry_chapters for select to anon
  using (exists (select 1 from entries e where e.id = entry_id and e.status = 'published'));
create policy entry_chapters_read on public.entry_chapters for select to authenticated
  using (exists (select 1 from entries e where e.id = entry_id
                 and (e.status = 'published' or can_read_unpublished(e.owner_id))));
create policy entry_chapters_write on public.entry_chapters for all to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                 and (e.status <> 'published' or can_approve_entry(e.id))))
  with check (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)
                      and (e.status <> 'published' or can_approve_entry(e.id))));

create policy entry_revisions_read on public.entry_revisions for select to authenticated
  using (exists (select 1 from entries e where e.id = entry_id and can_edit_entry(e.owner_id)));

-- Obsah portrétů: veřejně čitelný, upravuje ho redakce s právem na články.
create policy timeline_public on public.timeline_events for select to anon, authenticated using (true);
create policy timeline_write on public.timeline_events for all to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));
create policy faq_public on public.faq_items for select to anon, authenticated using (true);
create policy faq_write on public.faq_items for all to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));
create policy resources_public on public.resources for select to anon, authenticated using (true);
create policy resources_write on public.resources for all to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));
create policy visual_embeds_public on public.visual_embeds for select to anon, authenticated using (true);
create policy visual_embeds_write on public.visual_embeds for all to authenticated
  using (has_perm('news', 'e') and can_edit_entry(null)) with check (has_perm('news', 'e') and can_edit_entry(null));

grant select on public.authors, public.entries, public.entry_countries, public.entry_chapters,
  public.timeline_events, public.faq_items, public.resources, public.visual_embeds,
  public.portrait_metrics to anon, authenticated;
grant select on public.entry_revisions to authenticated;
grant insert, update, delete on public.authors, public.entries, public.entry_countries, public.entry_chapters,
  public.timeline_events, public.faq_items, public.resources, public.visual_embeds,
  public.portrait_metrics to authenticated;

revoke execute on function public.keep_entry_revision() from public, anon, authenticated;
grant execute on function public.can_edit_entry(uuid), public.can_read_unpublished(uuid),
  public.can_approve_entry(uuid), public.submit_entry(uuid), public.approve_entry(uuid),
  public.send_back_entry(uuid, text), public.unpublish_entry(uuid) to authenticated;
revoke execute on function public.submit_entry(uuid), public.approve_entry(uuid),
  public.send_back_entry(uuid, text), public.unpublish_entry(uuid) from public, anon;
