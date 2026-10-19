-- =============================================================================
-- Drop the home map's subtopic pins (owner, 2026-10-19)
-- =============================================================================
--
-- Since fb93301 the home map shows the newest published entries, as many as
-- home_settings.featured_count says; nothing picks subtopics for it any more.
-- Since a47a056 the app neither reads nor writes the pins, so they go:
--
-- - home_featured_items with move_home_featured_item and the deferred trigger
--   that unpinned a deleted subtopic (A_home_featured_unpin →
--   unpin_removed_chapter), all from 20261013000220;
-- - home_featured, the two old slots (20261006000060), unused since
--   20261013000220 and marked there for this contract step.
--
-- Phase: contract. home_settings (the tile count) stays.
--
-- The trigger goes first: it runs on every subtopic delete (each topic save
-- through replace_entry_parts) and names home_featured_items. Tables drop with
-- their own triggers, policies, indexes and grants.
--
-- Covered by supabase/tests/home-settings.test.mjs.
-- =============================================================================

drop trigger if exists "A_home_featured_unpin" on public.entry_chapters;
drop function if exists public.unpin_removed_chapter();
drop function if exists public.move_home_featured_item(uuid, boolean);
drop table if exists public.home_featured_items;
drop table if exists public.home_featured;
