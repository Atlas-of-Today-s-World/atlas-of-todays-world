-- =============================================================================
-- Regiony, země, ukazatele, palety, vlastní celky a plochy na mapě
-- =============================================================================
--
-- Geometrie hranic zůstává v gitu (public/data/*.geo.json) — je to výstup
-- skriptu z Natural Earth, ne redakční obsah. V databázi je všechno, co se
-- upravuje v administraci: hodnoty ukazatelů, palety, celky a plochy.
--
-- Všechno tady je veřejně čitelné (mapa se kreslí i nepřihlášenému čtenáři);
-- zápis hlídají sekce `regions`, `layers`, `appearance`, `specials` a `areas`.
-- =============================================================================

create table public.regions (
  slug              text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null,
  tagline           text not null default '',
  fill              text not null check (fill ~ '^#[0-9a-fA-F]{6}$'),
  stroke            text not null check (stroke ~ '^#[0-9a-fA-F]{6}$'),
  center_lon        numeric not null check (center_lon between -180 and 180),
  center_lat        numeric not null check (center_lat between -90 and 90),
  zoom              numeric not null default 2,
  summary           text not null default '',
  intro             text not null default '',
  portrait_status   text not null default 'skeleton' check (portrait_status in ('populated', 'skeleton')),
  position          integer not null default 100,
  updated_at        timestamptz not null default now()
);

create table public.countries (
  iso3            text primary key check (iso3 ~ '^[A-Z]{3}$'),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  name_formal     text,
  region_slug     text references public.regions (slug) on update cascade,
  un_subregion    text,
  population      bigint check (population >= 0),
  lon             numeric check (lon between -180 and 180),
  lat             numeric check (lat between -90 and 90),
  bbox            numeric[] check (bbox is null or array_length(bbox, 1) = 4),
  -- Poznámka o statusu (Kosovo, Palestina, Tchaj-wan…) a vlastní úvodní věta
  -- u území, pro která nejsou importované ukazatele.
  territory_note  text,
  blurb           text,
  updated_at      timestamptz not null default now()
);
create index countries_region on public.countries (region_slug);

alter table public.approver_countries
  add constraint approver_countries_country
  foreign key (country_iso3) references public.countries (iso3) on delete cascade;

-- ---------------------------------------------------------------------------
-- Ukazatele
-- ---------------------------------------------------------------------------

create table public.indicators (
  id                text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 60),
  label             text not null check (length(btrim(label)) between 1 and 120),
  short_label       text not null default '',
  description       text not null default '' check (length(description) <= 1000),
  unit              text not null default '' check (length(unit) <= 20),
  decimals          integer not null default 1 check (decimals between 0 and 4),
  source            text not null default '',
  source_url        text,
  type              text not null default 'sequential' check (type in ('sequential', 'categorical')),
  scale             text not null default 'linear' check (scale in ('linear', 'log')),
  domain_min        numeric,
  domain_max        numeric,
  ramp              text[] not null default '{}',
  higher_is_better  boolean not null default true,
  latest_year       integer,
  -- Importované z Our World in Data vs. založené v administraci.
  is_custom         boolean not null default false,
  created_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now(),
  check (type = 'categorical' or (domain_min is not null and domain_max is not null and domain_min <> domain_max))
);

create table public.indicator_categories (
  indicator_id  text not null references public.indicators (id) on delete cascade,
  value         integer not null,
  label         text not null check (length(btrim(label)) between 1 and 80),
  color         text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  primary key (indicator_id, value)
);

create table public.indicator_values (
  indicator_id  text not null references public.indicators (id) on delete cascade,
  country_iso3  text not null references public.countries (iso3) on delete cascade,
  value         numeric not null,
  year          integer,
  -- Krátký štítek u hodnoty v profilu země („odhad", „bez Krymu"…).
  note          text check (length(note) <= 120),
  -- Ruční hodnota musí říct, odkud je. Import ji nechá prázdnou (platí zdroj ukazatele).
  source_note   text check (length(source_note) <= 300),
  is_manual     boolean not null default false,
  updated_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (indicator_id, country_iso3)
);
create index indicator_values_country on public.indicator_values (country_iso3);

-- Jak se ukazatel kreslí. Samostatně od dat, ať přebarvení nesahá na hodnoty.
create table public.indicator_styles (
  indicator_id  text primary key references public.indicators (id) on delete cascade,
  preset        text not null default 'atlas',
  stops         text[] not null default '{}',
  reverse       boolean not null default false,
  saturation    numeric not null default 1 check (saturation between 0 and 2),
  steps         integer not null default 0 check (steps = 0 or steps between 2 and 12),
  domain_min    numeric,
  domain_max    numeric,
  updated_at    timestamptz not null default now()
);

create table public.site_theme (
  id             integer primary key default 1 check (id = 1),
  saturation     numeric not null default 1 check (saturation between 0.2 and 2),
  border         numeric not null default 1 check (border between 0.4 and 2.2),
  region_colors  jsonb not null default '{}'::jsonb check (jsonb_typeof(region_colors) = 'object'),
  updated_at     timestamptz not null default now()
);
insert into public.site_theme default values;

-- ---------------------------------------------------------------------------
-- Vlastní celky (skládají se z celých zemí) a plochy (libovolný obrazec)
-- ---------------------------------------------------------------------------

create table public.special_regions (
  slug        text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (length(btrim(name)) between 1 and 120),
  subtitle    text not null default '',
  summary     text not null default '',
  fill        text not null check (fill ~ '^#[0-9a-fA-F]{6}$'),
  stroke      text not null check (stroke ~ '^#[0-9a-fA-F]{6}$'),
  center_lon  numeric not null,
  center_lat  numeric not null,
  zoom        numeric not null default 2.6,
  created_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table public.special_region_countries (
  special_slug  text not null references public.special_regions (slug) on delete cascade on update cascade,
  country_iso3  text not null references public.countries (iso3) on delete cascade,
  primary key (special_slug, country_iso3)
);

-- Je to platný GeoJSON Polygon s jedním uzavřeným prstencem v rozsahu souřadnic?
create or replace function public.is_polygon(g jsonb)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  ring jsonb;
  point jsonb;
  n integer;
begin
  -- Každá kontrola zvlášť: SQL nezaručuje pořadí vyhodnocení v jedné podmínce
  -- a délka pole nebo převod na číslo nad špatným typem skončí chybou.
  if jsonb_typeof(g) is distinct from 'object' or g ->> 'type' is distinct from 'Polygon' then
    return false;
  end if;
  if jsonb_typeof(g -> 'coordinates') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(g -> 'coordinates') <> 1 then
    return false;
  end if;
  ring := g -> 'coordinates' -> 0;
  if jsonb_typeof(ring) is distinct from 'array' then
    return false;
  end if;
  n := jsonb_array_length(ring);
  -- Aspoň tři rohy plus návrat do prvního; strop, ať do sloupce nikdo neuloží pobřeží v plném rozlišení.
  if n < 4 or n > 2000 then
    return false;
  end if;
  if ring -> 0 is distinct from ring -> (n - 1) then
    return false;
  end if;
  for point in select value from jsonb_array_elements(ring) loop
    if jsonb_typeof(point) is distinct from 'array' then
      return false;
    end if;
    if jsonb_array_length(point) <> 2 then
      return false;
    end if;
    if jsonb_typeof(point -> 0) is distinct from 'number' or jsonb_typeof(point -> 1) is distinct from 'number' then
      return false;
    end if;
    if (point ->> 0)::numeric not between -180 and 180 or (point ->> 1)::numeric not between -90 and 90 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Obrazec je GeoJSON Polygon v jsonb. PostGIS by se hodil až pro prostorové
-- dotazy („které plochy leží v Evropě"); zatím ho nic nepotřebuje.
create table public.map_areas (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(btrim(name)) between 1 and 120),
  label         text not null default '',
  country_iso3  text references public.countries (iso3) on delete set null,
  note          text not null default '' check (length(note) <= 1000),
  fill          text not null check (fill ~ '^#[0-9a-fA-F]{6}$'),
  stroke        text not null check (stroke ~ '^#[0-9a-fA-F]{6}$'),
  geometry      jsonb not null check (public.is_polygon(geometry)),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Kdo změnil ruční hodnotu a kdy
-- ---------------------------------------------------------------------------

create or replace function public.stamp_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.stamp_indicator_value()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.is_manual := true;
    -- Každé číslo v Atlasu má původ. Ruční hodnota bez zdroje neprojde.
    if new.source_note is null or length(btrim(new.source_note)) = 0 then
      raise exception 'A value entered by hand needs a source.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger regions_stamp before update on public.regions for each row execute function public.stamp_row();
create trigger countries_stamp before update on public.countries for each row execute function public.stamp_row();
create trigger indicators_stamp before update on public.indicators for each row execute function public.stamp_row();
create trigger indicator_styles_stamp before insert or update on public.indicator_styles for each row execute function public.stamp_row();
create trigger site_theme_stamp before update on public.site_theme for each row execute function public.stamp_row();
create trigger special_regions_stamp before update on public.special_regions for each row execute function public.stamp_row();
create trigger map_areas_stamp before update on public.map_areas for each row execute function public.stamp_row();
create trigger indicator_values_stamp before insert or update on public.indicator_values
  for each row execute function public.stamp_indicator_value();

create trigger indicators_audit after insert or update or delete on public.indicators
  for each row execute function public.audit_row('id');
create trigger indicator_values_audit after insert or update or delete on public.indicator_values
  for each row when (auth.uid() is not null) execute function public.audit_row('country_iso3');
create trigger map_areas_audit after insert or update or delete on public.map_areas
  for each row execute function public.audit_row('slug');
create trigger special_regions_audit after insert or update or delete on public.special_regions
  for each row execute function public.audit_row('slug');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.regions enable row level security;
alter table public.countries enable row level security;
alter table public.indicators enable row level security;
alter table public.indicator_categories enable row level security;
alter table public.indicator_values enable row level security;
alter table public.indicator_styles enable row level security;
alter table public.site_theme enable row level security;
alter table public.special_regions enable row level security;
alter table public.special_region_countries enable row level security;
alter table public.map_areas enable row level security;

-- Veřejné čtení všeho, z čeho se kreslí mapa.
create policy regions_public on public.regions for select to anon, authenticated using (true);
create policy countries_public on public.countries for select to anon, authenticated using (true);
create policy indicators_public on public.indicators for select to anon, authenticated using (true);
create policy indicator_categories_public on public.indicator_categories for select to anon, authenticated using (true);
create policy indicator_values_public on public.indicator_values for select to anon, authenticated using (true);
create policy indicator_styles_public on public.indicator_styles for select to anon, authenticated using (true);
create policy site_theme_public on public.site_theme for select to anon, authenticated using (true);
create policy special_regions_public on public.special_regions for select to anon, authenticated using (true);
create policy special_region_countries_public on public.special_region_countries for select to anon, authenticated using (true);
create policy map_areas_public on public.map_areas for select to anon, authenticated using (true);

-- Regiony a země: redakční pole (úvod, poznámka o statusu). Zakládá je import.
create policy regions_change on public.regions for update to authenticated
  using (has_perm('regions', 'e')) with check (has_perm('regions', 'e'));
create policy countries_change on public.countries for update to authenticated
  using (has_perm('regions', 'e')) with check (has_perm('regions', 'e'));

-- Hodnoty ukazatelů upravuje sekce Regions & countries i Data layers.
create policy indicator_values_write on public.indicator_values for all to authenticated
  using (has_perm('regions', 'e') or has_perm('layers', 'e'))
  with check (has_perm('regions', 'e') or has_perm('layers', 'e'));

-- Ukazatele: přidat vlastní, upravit popis a škálu, smazat jen vlastní.
create policy indicators_add on public.indicators for insert to authenticated
  with check (has_perm('layers', 'c') and is_custom);
create policy indicators_change on public.indicators for update to authenticated
  using (has_perm('layers', 'e')) with check (has_perm('layers', 'e'));
create policy indicators_remove on public.indicators for delete to authenticated
  using (has_perm('layers', 'd') and is_custom);

create policy indicator_categories_write on public.indicator_categories for all to authenticated
  using (has_perm('layers', 'e')) with check (has_perm('layers', 'e'));
create policy indicator_styles_write on public.indicator_styles for all to authenticated
  using (has_perm('layers', 'e')) with check (has_perm('layers', 'e'));

create policy site_theme_change on public.site_theme for update to authenticated
  using (has_perm('appearance', 'e')) with check (has_perm('appearance', 'e'));

create policy special_regions_add on public.special_regions for insert to authenticated
  with check (has_perm('specials', 'c'));
create policy special_regions_change on public.special_regions for update to authenticated
  using (has_perm('specials', 'e')) with check (has_perm('specials', 'e'));
create policy special_regions_remove on public.special_regions for delete to authenticated
  using (has_perm('specials', 'd'));
create policy special_region_countries_write on public.special_region_countries for all to authenticated
  using (has_perm('specials', 'e') or has_perm('specials', 'c'))
  with check (has_perm('specials', 'e') or has_perm('specials', 'c'));

create policy map_areas_add on public.map_areas for insert to authenticated
  with check (has_perm('areas', 'c'));
create policy map_areas_change on public.map_areas for update to authenticated
  using (has_perm('areas', 'e')) with check (has_perm('areas', 'e'));
create policy map_areas_remove on public.map_areas for delete to authenticated
  using (has_perm('areas', 'd'));

grant select on public.regions, public.countries, public.indicators, public.indicator_categories,
  public.indicator_values, public.indicator_styles, public.site_theme, public.special_regions,
  public.special_region_countries, public.map_areas to anon, authenticated;
grant insert, update, delete on public.indicators, public.indicator_categories, public.indicator_values,
  public.indicator_styles, public.special_regions, public.special_region_countries, public.map_areas
  to authenticated;
grant update on public.regions, public.countries, public.site_theme to authenticated;
