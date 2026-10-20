-- =============================================================================
-- Atlas Patrons: drop the one-time donation settings (contract)
-- =============================================================================
--
-- Phase: contract, after 20261019000200 (expand). One-time donations were
-- removed on 2026-10-19; the app deployed with 77204fa no longer reads or
-- writes one_time_amounts, default_one_time or default_period (it selects
-- named columns and updates only the ones its admin form has), so dropping
-- them now cannot break the running app.
--
-- Dropped with them: their CHECKs (patron_settings_one_time_amounts_check,
-- patron_settings_default_one_time_check, the default_period check) and their
-- column grants. "Other amount" can now be offered for monthly donations only.
--
-- Tests: supabase/tests/patron-settings.test.mjs.
-- =============================================================================

update public.patron_settings
set other_amount_periods = array_remove(other_amount_periods, 'one-time')
where 'one-time' = any (other_amount_periods);

alter table public.patron_settings
  drop constraint if exists patron_settings_default_one_time_check,
  drop column if exists one_time_amounts,
  drop column if exists default_one_time,
  drop column if exists default_period,
  drop constraint if exists patron_settings_other_amount_periods_check,
  add constraint patron_settings_other_amount_periods_check
    check (other_amount_periods <@ array['monthly']::text[]
           and array_position(other_amount_periods, null) is null);
