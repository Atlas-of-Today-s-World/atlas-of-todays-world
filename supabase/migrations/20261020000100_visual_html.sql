-- =============================================================================
-- Maps & charts: custom HTML code (owner, 2026-10-20)
-- =============================================================================
--
-- The editors need infographics that no allowlisted provider hosts: a whole
-- HTML block with its own styles and script (the first one, a map of U.S.
-- strikes on Iran, is about 60 kB). ADR-027 stored no HTML; ADR-032 keeps the
-- reason — no editor's code ever runs in the site's origin — and adds a
-- fourth kind:
--
--   html — `html`, the code as pasted (a fragment or a whole document), at
--          most 512 kB. The site never puts it into its own pages: it is
--          served on its own by /api/visual-html/<id> under a CSP `sandbox`
--          (an opaque origin, no cookies, no storage, no access to the page
--          that frames it) and framed by the site's own sandboxed iframe
--          without allow-same-origin.
--
-- Expand-only: a column, wider CHECKs, grants. An app from before this
-- migration never writes `html` and leaves html rows out (toVisualItems keeps
-- only the kinds it knows), so the deploy order doesn't matter.
-- portrait() is unchanged: its visuals carry the id, and the frame loads the
-- code by it — the cached portrait stays small.
-- Tests: supabase/tests/visuals.test.mjs.
-- =============================================================================

alter table public.visuals
  add column html text
    constraint visuals_html_len check (octet_length(html) <= 524288);

alter table public.visuals drop constraint visuals_kind_check;
alter table public.visuals add constraint visuals_kind_check
  check (kind in ('embed', 'image', 'map', 'html'));

-- Each kind carries its own content and nothing else (as 20261015000100, plus html).
alter table public.visuals drop constraint visuals_kind_fields;
alter table public.visuals add constraint visuals_kind_fields check (
  case kind
    when 'embed' then provider is not null and embed_url is not null
                      and image_url is null and map_spec is null and html is null
    when 'image' then image_url is not null
                      and provider is null and embed_url is null and map_spec is null
                      and html is null
    when 'map' then map_spec is not null
                    and provider is null and embed_url is null and image_url is null
                    and html is null
    when 'html' then html is not null and length(btrim(html)) > 0
                     and provider is null and embed_url is null and image_url is null
                     and map_spec is null
    else false
  end);

-- The code can be half a megabyte: kept out of the audit log like map_spec
-- (that it changed shows by updated_at).
drop trigger visuals_audit on public.visuals;
create trigger visuals_audit
  after insert or update or delete on public.visuals
  for each row execute function public.audit_row('id', 'map_spec', 'html');

-- anon reads it for /api/visual-html (RLS: public owners only); the editors write it.
grant select (html) on public.visuals to anon;
grant insert (html) on public.visuals to authenticated;
grant update (html) on public.visuals to authenticated;
