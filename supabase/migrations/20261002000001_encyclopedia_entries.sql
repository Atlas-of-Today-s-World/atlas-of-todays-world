-- =============================================================================
-- Encyklopedická hesla P9 (PLAN G4)
-- =============================================================================
--
-- Heslo (`entries.kind = 'entry'`) má navíc proti novince:
--   - 3–5 odrážek shrnutí v hlavičce (`entries.summary_points`),
--   - zvukovou verzi (`entries.audio_url`, soubor v bucketu `entry-audio`),
--   - 4–6 kapitol (`entry_chapters`, tabulka už existuje) a vlastní zdroje
--     (`resources.entry_id`, tabulka i politiky už existují).
--
-- Kapitoly a zdroje se ukládají celé najednou přes `replace_entry_parts()`
-- (security invoker, smazání i vložení v jedné transakci pod RLS volajícího)
-- — stejný vzor jako `replace_portrait_items()`.
--
-- Plánovaná, ještě nenapsaná hesla vidí čtenář na portrétu šedivě. Anonym
-- nesmí číst nezveřejněné řádky `entries`, proto je dostane jen přes
-- `planned_entries()`, a to jen titulek, kategorii a zařazení — nic z textu.
-- =============================================================================

-- Krátké položky v poli: nejvýš `p_items` položek, každá nejvýš `p_len` znaků.
create or replace function public.short_items(p_values text[], p_items integer, p_len integer)
returns boolean
language sql immutable
set search_path = public, pg_temp
as $$
  select cardinality(p_values) <= p_items
     and coalesce((select max(length(v)) from unnest(p_values) v), 0) <= p_len
$$;

-- ---------------------------------------------------------------------------
-- 1. Hlavička hesla: odrážky shrnutí a zvuková verze
-- ---------------------------------------------------------------------------

alter table public.entries
  add column summary_points text[] not null default '{}'
    constraint entries_summary_points_short check (public.short_items(summary_points, 5, 300)),
  add column audio_url text
    constraint entries_audio_url_https check (audio_url is null or (audio_url ~ '^https://' and length(audio_url) <= 1000));

-- Veřejné sloupce (DB-08): anon čte jen vyjmenované.
grant select (summary_points, audio_url) on public.entries to anon;

-- ---------------------------------------------------------------------------
-- 2. Kapitoly: limity shodné se Zod schématem editoru
-- ---------------------------------------------------------------------------

alter table public.entry_chapters
  add constraint entry_chapters_position_range check (position between 0 and 7),
  add constraint entry_chapters_summary_short check (public.short_items(summary_points, 5, 300)),
  add constraint entry_chapters_illustration_credit_len
    check (illustration_credit is null or length(illustration_credit) <= 300),
  add constraint entry_chapters_illustration_url_len
    check (illustration_url is null or length(illustration_url) <= 1000);

-- ---------------------------------------------------------------------------
-- 3. Uložení kapitol a zdrojů hesla jedním voláním
-- ---------------------------------------------------------------------------

create or replace function public.replace_entry_parts(p_entry uuid, p_part text, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a list.' using errcode = '22023';
  end if;
  -- Stejná podmínka jako politiky kapitol a zdrojů; tady hlavně kvůli jasné
  -- chybě — bez ní by prázdný seznam od cizího uživatele tiše „prošel".
  if not exists (select 1 from entries e
                  where e.id = p_entry and can_edit_entry(e.owner_id)
                    and (e.status <> 'published' or can_approve_entry(e.id))) then
    raise exception 'You may not edit this entry.' using errcode = '42501';
  end if;

  case p_part
  when 'chapters' then
    if jsonb_array_length(p_items) > 8 then
      raise exception 'An entry holds at most 8 chapters.' using errcode = '22023';
    end if;
    delete from entry_chapters where entry_id = p_entry;
    insert into entry_chapters (entry_id, position, title, summary_points, body_html,
                                illustration_url, illustration_credit)
    select p_entry, (ord - 1)::int, i ->> 'title',
           coalesce(array(select jsonb_array_elements_text(coalesce(i -> 'summary_points', '[]'))), '{}'),
           coalesce(i ->> 'body_html', ''),
           nullif(i ->> 'illustration_url', ''), nullif(i ->> 'illustration_credit', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'resources' then
    if jsonb_array_length(p_items) > 50 then
      raise exception 'An entry holds at most 50 resources.' using errcode = '22023';
    end if;
    delete from resources where entry_id = p_entry;
    insert into resources (entry_id, position, kind, title, source, description, url, image_url)
    select p_entry, (ord - 1)::int, i ->> 'kind', i ->> 'title', coalesce(i ->> 'source', ''),
           coalesce(i ->> 'description', ''), i ->> 'url', nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  else
    raise exception 'Unknown entry part.' using errcode = '22023';
  end case;
end;
$$;

revoke execute on function public.replace_entry_parts(uuid, text, jsonb) from public, anon;
grant execute on function public.replace_entry_parts(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Plánovaná hesla pro šedivé dlaždice na portrétu
-- ---------------------------------------------------------------------------

create or replace function public.planned_entries()
returns table (
  title         text,
  category      text,
  region_slug   text,
  special_slug  text,
  countries     text[]
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.title, e.category, e.region_slug, e.special_slug,
         coalesce((select array_agg(c.country_iso3 order by c.country_iso3)
                     from entry_countries c where c.entry_id = e.id), '{}')
  from entries e
  where e.kind = 'entry' and e.status = 'planned'
  order by e.title
  limit 500
$$;

revoke execute on function public.planned_entries() from public;
grant execute on function public.planned_entries() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Zvuková verze: veřejný bucket, zápis jako u obrázků
-- ---------------------------------------------------------------------------
-- Pět běžných formátů (MP3, M4A/AAC, Ogg Vorbis/Opus, WAV, FLAC) včetně
-- alternativních MIME typů, které posílají různé prohlížeče a systémy.
-- 50 MB = strop jednoho souboru na tarifu Free.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-audio', 'entry-audio', true, 52428800,
        array['audio/mpeg', 'audio/mp3',
              'audio/mp4', 'audio/x-m4a', 'audio/aac',
              'audio/ogg', 'audio/opus',
              'audio/wav', 'audio/x-wav', 'audio/wave',
              'audio/flac', 'audio/x-flac'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy entry_audio_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-audio'
              and public.has_perm('news', 'c')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy entry_audio_change on storage.objects for update to authenticated
  using (bucket_id = 'entry-audio' and (owner_id = auth.uid()::text or public.can_edit_entry(null)))
  with check (bucket_id = 'entry-audio' and (owner_id = auth.uid()::text or public.can_edit_entry(null)));
create policy entry_audio_remove on storage.objects for delete to authenticated
  using (bucket_id = 'entry-audio' and (owner_id = auth.uid()::text or public.can_edit_entry(null)));

-- ---------------------------------------------------------------------------
-- 6. Náhled hesla přes sdílený odkaz (G2): části, které entry_preview nevrací
-- ---------------------------------------------------------------------------
-- Stejná kontrola tokenu jako entry_preview(); prázdné, když token neplatí.

create or replace function public.entry_preview_parts(p_token text)
returns table (
  kind text, summary_points text[], audio_url text, author jsonb, chapters jsonb, resources jsonb
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.kind, e.summary_points, e.audio_url,
         (select jsonb_build_object('name', a.name, 'photo_url', a.photo_url, 'bio', a.bio,
                                    'positionality', a.positionality)
            from authors a where a.id = e.author_id),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', c.position, 'title', c.title, 'summary_points', c.summary_points,
                     'body_html', c.body_html, 'illustration_url', c.illustration_url,
                     'illustration_credit', c.illustration_credit) order by c.position)
                     from entry_chapters c where c.entry_id = e.id), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'kind', r.kind, 'title', r.title, 'source', r.source,
                     'description', r.description, 'url', r.url, 'image_url', r.image_url)
                     order by r.position)
                     from resources r where r.entry_id = e.id), '[]')
  from preview_links l
  join entries e on e.id = l.entry_id
  where p_token ~ '^[0-9a-f]{64}$'
    and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and l.expires_at > now();
$$;

revoke execute on function public.entry_preview_parts(text) from public;
grant execute on function public.entry_preview_parts(text) to anon, authenticated;
