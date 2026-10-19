-- =============================================================================
-- Atlas Patrons: monthly donations only (owner decision, 2026-10-19)
-- =============================================================================
--
-- Phase: expand only (data). The app no longer offers one-time donations and
-- no longer reads one_time_amounts, default_one_time or default_period; those
-- columns and their CHECKs stay until a later contract migration drops them,
-- so the app before this deploy keeps working.
--
-- 1. patron_settings: the card always opens on monthly, and "Other amount" is
--    no longer offered for one-time donations.
-- 2. The FAQ answer about cancelling loses its sentence about turning a
--    one-time donation into a monthly one. Applied only while that exact
--    sentence is still there, so an answer the editors rewrote is left alone.
--
-- Tests: supabase/tests/patron-settings.test.mjs.
-- =============================================================================

update public.patron_settings
set default_period = 'monthly',
    other_amount_periods = array_remove(other_amount_periods, 'one-time')
where id = 1
  and (default_period <> 'monthly' or 'one-time' = any (other_amount_periods));

update public.patron_faq
set answer_html = replace(
      answer_html,
      ' Similarly, you can change your initial one-time donation to a monthly donation by following the same steps.',
      ''
    )
where answer_html like '% Similarly, you can change your initial one-time donation to a monthly donation by following the same steps.%';
