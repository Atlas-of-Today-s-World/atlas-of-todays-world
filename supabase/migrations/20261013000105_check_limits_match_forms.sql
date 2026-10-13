-- =============================================================================
-- CHECKs for the limits the admin forms already enforce
-- =============================================================================
--
-- The standard (ARCHITEKTURA 6, "validation: limits equal to the DB CHECK")
-- says the database holds the same limits as the Zod schemas. These columns
-- were limited only in Zod, so a write through PostgREST, an RPC or an import
-- could store more than any form accepts. Every limit below is the one the
-- form's schema already has (src/features/*/schema.ts; URLs: httpsUrl, 1000).
--
-- Each constraint is added NOT VALID (no table scan under the lock), then
-- validated where existing data is known to fit:
--   * text limits — the forms have enforced exactly these limits since the
--     columns got a form (no limit was ever loosened), and the Webflow import
--     (scripts/webflow) clips every text it writes to the same lengths;
--   * URL caps on columns only the forms and the seed write, or an import
--     whose data is in the repo (authors.photo_url: scripts/webflow/data/
--     global-issues.json carries no author photo);
--   * the seed fits all of them (supabase/tests/check-limits.test.mjs).
-- Stays NOT VALID (new and changed rows are checked, old rows aren't): the URL
-- caps on columns the Webflow portrait import fills with URLs taken verbatim
-- from an export that isn't in the repository (resources, timeline images,
-- metric sources, region hero) — a longer URL there can't be ruled out, and
-- failing a deploy over it would be worse than leaving it be.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Portrait sections (COLLECTIONS in src/features/portraits/schema.ts)
-- ---------------------------------------------------------------------------

alter table public.timeline_events
  add constraint timeline_events_date_label_len check (length(date_label) <= 60) not valid,
  add constraint timeline_events_title_len check (length(title) <= 200) not valid,
  add constraint timeline_events_body_len check (length(body) <= 2000) not valid,
  add constraint timeline_events_image_url_len check (length(image_url) <= 1000) not valid;
alter table public.timeline_events validate constraint timeline_events_date_label_len;
alter table public.timeline_events validate constraint timeline_events_title_len;
alter table public.timeline_events validate constraint timeline_events_body_len;

-- 3,000 characters: a portrait answer. A topic's FAQ (entry_faq) keeps its own,
-- shorter 2,000 — see EntryFaqItem in src/features/entries/schema.ts.
alter table public.faq_items
  add constraint faq_items_question_len check (length(question) <= 300) not valid,
  add constraint faq_items_answer_len check (length(answer) <= 3000) not valid;
alter table public.faq_items validate constraint faq_items_question_len;
alter table public.faq_items validate constraint faq_items_answer_len;

-- Portrait resources and a topic's learn-more links share the table and the limits.
alter table public.resources
  add constraint resources_title_len check (length(title) <= 200) not valid,
  add constraint resources_source_len check (length(source) <= 120) not valid,
  add constraint resources_description_len check (length(description) <= 600) not valid,
  add constraint resources_url_len check (length(url) <= 1000) not valid,
  add constraint resources_image_url_len check (length(image_url) <= 1000) not valid;
alter table public.resources validate constraint resources_title_len;
alter table public.resources validate constraint resources_source_len;
alter table public.resources validate constraint resources_description_len;

alter table public.visual_embeds
  add constraint visual_embeds_title_len check (length(title) <= 200) not valid,
  add constraint visual_embeds_caption_len check (length(caption) <= 500) not valid,
  add constraint visual_embeds_url_len check (length(url) <= 1000) not valid;
alter table public.visual_embeds validate constraint visual_embeds_title_len;
alter table public.visual_embeds validate constraint visual_embeds_caption_len;
alter table public.visual_embeds validate constraint visual_embeds_url_len;

alter table public.portrait_metrics
  add constraint portrait_metrics_source_url_len check (length(source_url) <= 1000) not valid;

-- ---------------------------------------------------------------------------
-- Region and global issue headers (RegionInput, IssueInput)
-- ---------------------------------------------------------------------------

alter table public.regions
  add constraint regions_name_check
    check (length(btrim(name)) between 1 and 120) not valid,
  add constraint regions_tagline_len check (length(tagline) <= 200) not valid,
  add constraint regions_summary_len check (length(summary) <= 1000) not valid,
  add constraint regions_intro_len check (length(intro) <= 5000) not valid,
  add constraint regions_timeline_title_len check (length(timeline_title) <= 120) not valid,
  add constraint regions_timeline_subtitle_len check (length(timeline_subtitle) <= 300) not valid,
  add constraint regions_hero_url_len check (length(hero_url) <= 1000) not valid;
alter table public.regions validate constraint regions_name_check;
alter table public.regions validate constraint regions_tagline_len;
alter table public.regions validate constraint regions_summary_len;
alter table public.regions validate constraint regions_intro_len;
alter table public.regions validate constraint regions_timeline_title_len;
alter table public.regions validate constraint regions_timeline_subtitle_len;

alter table public.special_regions
  add constraint special_regions_subtitle_len check (length(subtitle) <= 200) not valid,
  add constraint special_regions_summary_len check (length(summary) <= 1000) not valid,
  add constraint special_regions_intro_len check (length(intro) <= 5000) not valid,
  add constraint special_regions_timeline_title_len
    check (length(timeline_title) <= 120) not valid,
  add constraint special_regions_timeline_subtitle_len
    check (length(timeline_subtitle) <= 300) not valid,
  add constraint special_regions_hero_url_len check (length(hero_url) <= 1000) not valid,
  -- The same ranges as regions; the zoom as the issue form allows it.
  add constraint special_regions_center_lon_check
    check (center_lon between -180 and 180) not valid,
  add constraint special_regions_center_lat_check
    check (center_lat between -90 and 90) not valid,
  add constraint special_regions_zoom_check check (zoom between 0.5 and 9) not valid;
alter table public.special_regions validate constraint special_regions_subtitle_len;
alter table public.special_regions validate constraint special_regions_summary_len;
alter table public.special_regions validate constraint special_regions_intro_len;
alter table public.special_regions validate constraint special_regions_timeline_title_len;
alter table public.special_regions validate constraint special_regions_timeline_subtitle_len;
alter table public.special_regions validate constraint special_regions_hero_url_len;
alter table public.special_regions validate constraint special_regions_center_lon_check;
alter table public.special_regions validate constraint special_regions_center_lat_check;
alter table public.special_regions validate constraint special_regions_zoom_check;

alter table public.countries
  add constraint countries_blurb_len check (length(blurb) <= 1000) not valid;
alter table public.countries validate constraint countries_blurb_len;

-- ---------------------------------------------------------------------------
-- Data layers (IndicatorInput, ValueInput)
-- ---------------------------------------------------------------------------

alter table public.indicators
  add constraint indicators_short_label_len check (length(short_label) <= 60) not valid,
  add constraint indicators_source_len check (length(source) <= 200) not valid,
  add constraint indicators_source_url_len check (length(source_url) <= 1000) not valid,
  -- None or at most 9 colours, each #rrggbb: the list joined with commas (a NULL
  -- item as "-") must be exactly that; the length cap keeps a comma out of an item.
  add constraint indicators_ramp_check check (
    public.short_items(ramp, 9, 7)
    and (cardinality(ramp) = 0
      or array_to_string(ramp, ',', '-') ~ '^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6})*$')
  ) not valid;
alter table public.indicators validate constraint indicators_short_label_len;
alter table public.indicators validate constraint indicators_source_len;
alter table public.indicators validate constraint indicators_source_url_len;
alter table public.indicators validate constraint indicators_ramp_check;

alter table public.indicator_values
  add constraint indicator_values_year_check check (year between 1800 and 2100) not valid;
alter table public.indicator_values validate constraint indicator_values_year_check;

-- ---------------------------------------------------------------------------
-- Map areas, people, settings
-- ---------------------------------------------------------------------------

alter table public.map_areas
  add constraint map_areas_label_len check (length(label) <= 60) not valid;
alter table public.map_areas validate constraint map_areas_label_len;

-- 254: the longest address SMTP delivers (emailAddress in src/lib/validation/common.ts).
alter table public.invitations
  add constraint invitations_email_len check (length(email) <= 254) not valid;
alter table public.invitations validate constraint invitations_email_len;

alter table public.authors
  add constraint authors_photo_url_len check (length(photo_url) <= 1000) not valid;
alter table public.authors validate constraint authors_photo_url_len;

-- At most 20 role ids of up to 40 characters (SecurityInput).
alter table public.security_settings
  add constraint security_settings_require_2fa_roles_check
    check (public.short_items(require_2fa_roles, 20, 40)) not valid;
alter table public.security_settings
  validate constraint security_settings_require_2fa_roles_check;
