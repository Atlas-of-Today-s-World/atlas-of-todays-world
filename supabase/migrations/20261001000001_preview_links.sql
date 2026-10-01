-- G2: náhled nezveřejněného článku přes sdílitelný odkaz s expirací.
--
-- Odkaz nese náhodný token (256 bitů); v databázi je jen jeho SHA-256, takže
-- ani čtení tabulky odkaz neprozradí. Vytvořit ho smí jen ten, kdo článek smí
-- upravit nebo schválit; otevřít kdokoli s odkazem do vypršení (max. 30 dní).
-- Zápisy jen přes RPC, přímý insert/update nemá nikdo.

create table public.preview_links (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries (id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create index preview_links_entry on public.preview_links (entry_id);
create index preview_links_created_by on public.preview_links (created_by);

alter table public.preview_links enable row level security;

-- Platné odkazy k článku vidí, kdo ten článek smí vidět nezveřejněný.
create policy preview_links_select on public.preview_links for select to authenticated
  using (exists (select 1 from public.entries e
                 where e.id = entry_id and public.can_read_unpublished(e.owner_id)));

-- Zrušit odkaz smí jeho autor nebo kdokoli, kdo článek smí upravit.
create policy preview_links_delete on public.preview_links for delete to authenticated
  using (is_active() and (created_by = auth.uid() or exists (
           select 1 from public.entries e
           where e.id = entry_id and public.can_edit_entry(e.owner_id))));

revoke all on public.preview_links from public, anon, authenticated;
grant select (id, entry_id, expires_at, created_by, created_at) on public.preview_links to authenticated;
grant delete on public.preview_links to authenticated;

-- Nový odkaz na náhled; vrátí token (jen teď — uložený je jen jeho hash).
create or replace function public.create_preview_link(p_entry uuid, p_hours integer)
returns text
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_token text;
begin
  if p_hours is null or p_hours < 1 or p_hours > 720 then
    raise exception 'Platnost náhledu musí být 1 až 720 hodin' using errcode = '22023';
  end if;
  select owner_id into v_owner from entries where id = p_entry;
  if not found then
    raise exception 'Článek neexistuje' using errcode = 'P0002';
  end if;
  if not (is_active() and (can_edit_entry(v_owner) or can_approve_entry(p_entry))) then
    raise exception 'Náhled smí sdílet jen ten, kdo článek upravuje nebo schvaluje'
      using errcode = '42501';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into preview_links (entry_id, token_hash, expires_at, created_by)
  values (p_entry, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
          now() + make_interval(hours => p_hours), auth.uid());
  return v_token;
end;
$$;

-- Článek pro platný token (v jakémkoli stavu); prázdné, když token neplatí.
create or replace function public.entry_preview(p_token text)
returns table (
  slug text, title text, summary text, category text, region_slug text, special_slug text,
  cover_url text, cover_credit text, author_name text, published_on date,
  updated_at timestamptz, reading_minutes integer, body_html text, status text,
  countries text[], expires_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.slug, e.title, e.summary, e.category, e.region_slug, e.special_slug,
         e.cover_url, e.cover_credit, e.author_name, e.published_on,
         e.updated_at, e.reading_minutes, e.body_html, e.status,
         coalesce((select array_agg(c.country_iso3 order by c.country_iso3)
                   from entry_countries c where c.entry_id = e.id), '{}'),
         l.expires_at
  from preview_links l
  join entries e on e.id = l.entry_id
  where p_token ~ '^[0-9a-f]{64}$'
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.expires_at > now();
$$;

revoke execute on function public.create_preview_link(uuid, integer) from public, anon;
grant execute on function public.create_preview_link(uuid, integer) to authenticated;
revoke execute on function public.entry_preview(text) from public;
grant execute on function public.entry_preview(text) to anon, authenticated;
