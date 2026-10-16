-- =============================================================================
-- Maps & charts in the preview by link (owner, 2026-10-16)
-- =============================================================================
--
-- A preview link (/preview/<token>) shows a topic as readers will see it, but
-- entry_preview_parts() never returned the topic's or its subtopics' visuals,
-- and anon may read them only once the topic is published (visuals_public).
-- A draft's "Maps & charts" carousel was therefore missing from the preview.
--
-- entry_preview_visuals(token): the visuals of the topic behind a valid,
-- unexpired link, as the public page reads them (the same columns anon may
-- read, VISUAL_COLUMNS in src/features/visuals/rows.ts) plus the position of
-- the subtopic a visual belongs to (null = the topic's own). Same token check
-- as entry_preview() / entry_preview_parts(); security definer like them.
--
-- Expand-only: a new function, nothing changed or dropped. The app tolerates
-- its absence (no visuals in the preview), so the deploy order doesn't matter.
-- Tests: supabase/tests/visuals.test.mjs.
-- =============================================================================

create function public.entry_preview_visuals(p_token text)
returns table (
  chapter_position integer, id uuid, "position" integer, kind text, title text,
  caption text, source_label text, source_url text, provider text, embed_url text,
  image_url text, height integer, map_spec jsonb
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  with entry as (
    select l.entry_id
    from preview_links l
    where p_token ~ '^[0-9a-f]{64}$'
      and l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      and l.expires_at > now()
  )
  select null::integer, v.id, v.position, v.kind, v.title, v.caption, v.source_label,
         v.source_url, v.provider, v.embed_url, v.image_url, v.height, v.map_spec
    from visuals v join entry on v.entry_id = entry.entry_id
  union all
  select c.position, v.id, v.position, v.kind, v.title, v.caption, v.source_label,
         v.source_url, v.provider, v.embed_url, v.image_url, v.height, v.map_spec
    from visuals v
    join entry_chapters c on c.id = v.chapter_id
    join entry on c.entry_id = entry.entry_id;
$$;

revoke execute on function public.entry_preview_visuals(text) from public;
grant execute on function public.entry_preview_visuals(text) to anon, authenticated;
