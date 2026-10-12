-- =============================================================================
-- Index for the public "newest first" lists (review 2026-10-07, D-L4)
-- =============================================================================
--
-- /news and /topics (src/features/entries/queries.ts, listPublished) read
--   status = 'published' and kind = ? and translation_of is null
--   order by published_on desc nulls last
-- The only matching index, entries_status (status, published_on desc), sorts
-- NULLs first, so it can't deliver that order and Postgres sorted every
-- published entry of the kind. This partial index holds exactly the listed
-- rows in the listed order. entries_status stays: admin lists filter by status.
-- =============================================================================

create index entries_published_list
  on public.entries (kind, published_on desc nulls last)
  where status = 'published' and translation_of is null;
