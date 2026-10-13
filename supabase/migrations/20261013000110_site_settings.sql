-- =============================================================================
-- Site settings and social links, editable in the admin (section `site`)
-- =============================================================================
--
-- Until now the publisher's facts, the contact e-mail, the default SEO title and
-- description, the default preview image, the footer copyright and the social
-- network links were constants in the code (config/organization.ts,
-- config/navigation.ts, app/layout.tsx). They move here so the team can change
-- them without a deployment. The app keeps the constants as its fallback: a
-- missing row or a failed read never breaks the site.
--
-- 1. site_settings — one row (id = 1), seeded with today's exact values.
--    Everyone reads it (it is shown on every page); `site` "e" changes it.
--    No insert or delete: the row always exists.
-- 2. site_social_links — the badges in the header and the profiles in the
--    publisher's structured data (sameAs). Everyone reads the visible ones;
--    the team with `site` "v" also the hidden ones; `site` c/e/d write.
-- 3. move_site_social_link(id, up) — swaps a link with its neighbour in one
--    transaction (invoker: RLS and the `site` "e" check still decide).
--
-- Grants are explicit (revoke all, then exactly what the policies intend), so
-- the migration does not rely on Supabase's default privileges for new tables.
-- No sequences: the ids are uuid / a fixed 1.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Settings (one row)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id               integer primary key default 1 check (id = 1),
  -- The publisher (schema.org NGO, About page, llms.txt, feeds).
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  alternate_names  text[] not null default '{}' check (
    cardinality(alternate_names) <= 10
    and array_position(alternate_names, null) is null
    and char_length(array_to_string(alternate_names, '')) <= 1200
  ),
  legal_name       text not null check (char_length(btrim(legal_name)) between 1 and 200),
  -- Czech company registration number (IČO).
  company_id       text not null check (company_id ~ '^\d{8}$'),
  founding_date    date not null,
  street_address   text not null check (char_length(btrim(street_address)) between 1 and 200),
  postal_code      text not null check (char_length(btrim(postal_code)) between 1 and 20),
  address_locality text not null check (char_length(btrim(address_locality)) between 1 and 120),
  address_country  text not null check (address_country ~ '^[A-Z]{2}$'),
  description      text not null check (char_length(btrim(description)) between 1 and 500),
  -- Wikidata item of the publisher (Q…); empty = none.
  wikidata_id      text check (wikidata_id is null or wikidata_id ~ '^Q[1-9][0-9]{0,11}$'),
  -- The one public contact address (About, legal pages, FAQ, feeds, structured data).
  contact_email    text not null check (
    char_length(contact_email) <= 254 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  -- Search and sharing defaults.
  seo_title        text not null check (char_length(btrim(seo_title)) between 1 and 120),
  -- Appended to page titles after a space ("— Atlas of Today's World"); empty = no suffix.
  title_suffix     text not null default '' check (char_length(title_suffix) <= 80),
  seo_description  text not null check (char_length(btrim(seo_description)) between 1 and 300),
  -- https:// or a path on this site ("/og-image.png"), never protocol-relative ("//", "/\").
  og_image_url     text not null check (
    char_length(og_image_url) <= 1000
    and (og_image_url ~ '^https://\S+$' or og_image_url ~ '^/[^/\\\s]\S*$')
  ),
  -- Footer.
  copyright        text not null check (char_length(btrim(copyright)) between 1 and 200),
  updated_at       timestamptz not null default now()
);

insert into public.site_settings (
  id, name, alternate_names, legal_name, company_id, founding_date,
  street_address, postal_code, address_locality, address_country,
  description, wikidata_id, contact_email,
  seo_title, title_suffix, seo_description, og_image_url, copyright
) values (
  1,
  'Atlas of Today''s World',
  array['Atlas of Todays World', 'ATW'],
  'Atlas of Today''s World, z. s.',
  '05363454',
  '2016-09-07',
  'náměstí Jana Palacha 1/2',
  '110 00',
  'Praha 1',
  'CZ',
  'Atlas of Today''s World is a non-profit, open-access encyclopedia of the present: every country, world region and global issue on an interactive 3D globe, with data from international sources and articles by experts.',
  'Q106194019',
  'info@atlasoftodaysworld.org',
  'Atlas of Today''s World — interactive atlas of every country',
  '— Atlas of Today''s World',
  'Explore every country and world region on an interactive satellite globe: political systems, living conditions, human development and the stories behind them.',
  '/og-image.png',
  '© Atlas of Today’s World'
) on conflict (id) do nothing;

create trigger site_settings_stamp
  before update on public.site_settings
  for each row execute function public.stamp_row();

create trigger site_settings_audit
  after update on public.site_settings
  for each row execute function public.audit_row('id');

alter table public.site_settings enable row level security;

create policy site_settings_read on public.site_settings
  for select to anon, authenticated
  using (true);
create policy site_settings_update on public.site_settings
  for update to authenticated
  using ((select public.has_perm('site', 'e')))
  with check ((select public.has_perm('site', 'e')));

revoke all on public.site_settings from anon, authenticated;
grant select (
  id, name, alternate_names, legal_name, company_id, founding_date,
  street_address, postal_code, address_locality, address_country,
  description, wikidata_id, contact_email,
  seo_title, title_suffix, seo_description, og_image_url, copyright
) on public.site_settings to anon;
grant select on public.site_settings to authenticated;
grant update (
  name, alternate_names, legal_name, company_id, founding_date,
  street_address, postal_code, address_locality, address_country,
  description, wikidata_id, contact_email,
  seo_title, title_suffix, seo_description, og_image_url, copyright
) on public.site_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Social links
-- ---------------------------------------------------------------------------
create table public.site_social_links (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(btrim(label)) between 1 and 60),
  url        text not null unique check (char_length(url) <= 1000 and url ~ '^https://\S+$'),
  -- The round badge's text ("IG", "in", "f", "bs").
  icon       text not null check (icon ~ '^\S{1,3}$'),
  position   integer not null default 0 check (position between 0 and 1000),
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index site_social_links_order on public.site_social_links (position, created_at);

insert into public.site_social_links (label, url, icon, position) values
  ('Instagram', 'https://www.instagram.com/atlasoftodaysworld_official/', 'IG', 0),
  ('LinkedIn', 'https://www.linkedin.com/company/atlas-of-todays-world/', 'in', 1),
  ('Facebook', 'https://www.facebook.com/atlasoftodaysworld/', 'f', 2),
  ('Bluesky', 'https://bsky.app/profile/atlas-otw.bsky.social', 'bs', 3)
on conflict (url) do nothing;

create trigger site_social_links_stamp
  before update on public.site_social_links
  for each row execute function public.stamp_row();

create trigger site_social_links_audit
  after insert or update or delete on public.site_social_links
  for each row execute function public.audit_row('id');

alter table public.site_social_links enable row level security;

create policy site_social_links_read_public on public.site_social_links
  for select to anon
  using (visible);
create policy site_social_links_read_team on public.site_social_links
  for select to authenticated
  using (visible or (select public.has_perm('site', 'v')));
create policy site_social_links_insert on public.site_social_links
  for insert to authenticated
  with check ((select public.has_perm('site', 'c')));
create policy site_social_links_update on public.site_social_links
  for update to authenticated
  using ((select public.has_perm('site', 'e')))
  with check ((select public.has_perm('site', 'e')));
create policy site_social_links_delete on public.site_social_links
  for delete to authenticated
  using ((select public.has_perm('site', 'd')));

revoke all on public.site_social_links from anon, authenticated;
grant select (id, label, url, icon, position, visible, created_at) on public.site_social_links to anon;
grant select on public.site_social_links to authenticated;
grant insert (label, url, icon, position, visible) on public.site_social_links to authenticated;
grant update (label, url, icon, position, visible) on public.site_social_links to authenticated;
grant delete on public.site_social_links to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reordering: swap with the neighbour above (p_up) or below
-- ---------------------------------------------------------------------------
create or replace function public.move_site_social_link(p_id uuid, p_up boolean)
returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  ordered uuid[];
  here integer;
  there integer;
begin
  if not (select public.has_perm('site', 'e')) then
    raise exception 'You can''t reorder social links.' using errcode = '42501';
  end if;
  select array_agg(id order by position, created_at, id) into ordered from site_social_links;
  here := array_position(ordered, p_id);
  if here is null then
    raise exception 'The social link no longer exists.' using errcode = '22023';
  end if;
  there := case when p_up then here - 1 else here + 1 end;
  if there < 1 or there > cardinality(ordered) then
    return;
  end if;
  ordered[here] := ordered[there];
  ordered[there] := p_id;
  -- Renumber 0…n-1 (positions may have had gaps or ties).
  update site_social_links s
     set position = o.n - 1
    from unnest(ordered) with ordinality as o (id, n)
   where s.id = o.id and s.position is distinct from (o.n - 1)::integer;
end;
$$;

revoke execute on function public.move_site_social_link(uuid, boolean) from public, anon;
grant execute on function public.move_site_social_link(uuid, boolean) to authenticated;
