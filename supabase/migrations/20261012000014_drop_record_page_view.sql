-- =============================================================================
-- record_page_view() removed (review 2026-10-07, D-L6)
-- =============================================================================
--
-- Added with the membership tables (20260929000004) to count pages read by a
-- signed-in account, but the app never calls it. Had it been wired in, every
-- page view would have written two rows (page_views_daily upsert + profiles
-- last_seen_at) on the request path. Any signed-in account could still call
-- it over the API and inflate its own counter. Dropping the function also
-- drops its grant to `authenticated`.
--
-- page_views_daily and members_overview.pages_read stay (read by the admin
-- Members page); a future counter should batch writes off the request path.
-- =============================================================================

drop function public.record_page_view();
