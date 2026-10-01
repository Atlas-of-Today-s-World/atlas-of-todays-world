-- =============================================================================
-- Zvuková verze po kapitolách (PLAN G4, rozhodnutí vlastníka 2026-10-01)
-- =============================================================================
--
-- Jedna nahrávka celého hesla (8–18 tisíc slov, 55–120 min) se nevejde do
-- limitu 50 MB na soubor ve vyšší kvalitě a čtenář ji neposlouchá najednou.
-- Zvuk proto patří ke kapitole (`entry_chapters.audio_url`, ~15–20 min,
-- 7–10 MB v MP3) a `entries.audio_url` z předchozí migrace odpadá — byl jen
-- na atlas-dev, v produkci nikdy.
-- =============================================================================

alter table public.entry_chapters
  add column audio_url text
    constraint entry_chapters_audio_url_https
    check (audio_url is null or (audio_url ~ '^https://' and length(audio_url) <= 1000));

-- Náhled vracel audio_url hesla — mění se návratový typ, proto drop + create.
drop function public.entry_preview_parts(text);
alter table public.entries drop column audio_url;

create function public.entry_preview_parts(p_token text)
returns table (
  kind text, summary_points text[], author jsonb, chapters jsonb, resources jsonb
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select e.kind, e.summary_points,
         (select jsonb_build_object('name', a.name, 'photo_url', a.photo_url, 'bio', a.bio,
                                    'positionality', a.positionality)
            from authors a where a.id = e.author_id),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'position', c.position, 'title', c.title, 'summary_points', c.summary_points,
                     'body_html', c.body_html, 'illustration_url', c.illustration_url,
                     'illustration_credit', c.illustration_credit, 'audio_url', c.audio_url)
                     order by c.position)
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

-- Uložení kapitol bere i zvuk (zbytek beze změny).
create or replace function public.replace_entry_parts(p_entry uuid, p_part text, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Items must be a list.' using errcode = '22023';
  end if;
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
                                illustration_url, illustration_credit, audio_url)
    select p_entry, (ord - 1)::int, i ->> 'title',
           coalesce(array(select jsonb_array_elements_text(coalesce(i -> 'summary_points', '[]'))), '{}'),
           coalesce(i ->> 'body_html', ''),
           nullif(i ->> 'illustration_url', ''), nullif(i ->> 'illustration_credit', ''),
           nullif(i ->> 'audio_url', '')
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
