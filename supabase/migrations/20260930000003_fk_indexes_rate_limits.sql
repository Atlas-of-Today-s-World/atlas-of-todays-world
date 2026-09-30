-- =============================================================================
-- Indexy na cizí klíče (DB-12) a sdílený rate limiting (SEC-06, ADR-011)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Indexy: kaskády a RLS se po cizích klíčích dotazují, bez indexu čtou celé tabulky.
-- ---------------------------------------------------------------------------

create index if not exists approver_countries_country on public.approver_countries (country_iso3);
create index if not exists approver_authors_author on public.approver_authors (author_id);
create index if not exists allowed_emails_added_by on public.allowed_emails (added_by);
create index if not exists audit_log_actor on public.audit_log (actor);
create index if not exists indicators_created_by on public.indicators (created_by);
create index if not exists indicator_values_updated_by on public.indicator_values (updated_by);
create index if not exists special_regions_created_by on public.special_regions (created_by);
create index if not exists special_region_countries_country on public.special_region_countries (country_iso3);
create index if not exists map_areas_country on public.map_areas (country_iso3);
create index if not exists map_areas_created_by on public.map_areas (created_by);
create index if not exists entries_author on public.entries (author_id);
create index if not exists entries_approved_by on public.entries (approved_by);
create index if not exists entry_revisions_saved_by on public.entry_revisions (saved_by);
create index if not exists timeline_events_region on public.timeline_events (region_slug, position);
create index if not exists timeline_events_special on public.timeline_events (special_slug, position);
create index if not exists faq_items_region on public.faq_items (region_slug, position);
create index if not exists faq_items_special on public.faq_items (special_slug, position);
create index if not exists visual_embeds_region on public.visual_embeds (region_slug, position);
create index if not exists visual_embeds_special on public.visual_embeds (special_slug, position);
create index if not exists resources_region on public.resources (region_slug, position);
create index if not exists resources_special on public.resources (special_slug, position);
create index if not exists resources_entry on public.resources (entry_id, position);
create index if not exists portrait_metrics_region on public.portrait_metrics (region_slug, position);
create index if not exists portrait_metrics_special on public.portrait_metrics (special_slug, position);
create index if not exists portrait_metrics_country on public.portrait_metrics (country_iso3, position);

-- ---------------------------------------------------------------------------
-- Rate limiting sdílený všemi instancemi aplikace
-- ---------------------------------------------------------------------------
-- Pevné okno: klíč (např. "newsletter:ip:1.2.3.4") + začátek okna → počet.
-- Volá se ze serveru servisním klíčem; klient k tabulce ani funkci nemá přístup.

create table public.rate_limits (
  key           text not null check (length(key) between 1 and 200),
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

-- Zaznamená pokus a vrátí true, pokud je ještě v limitu.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  count_now integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit.' using errcode = '22023';
  end if;
  insert into rate_limits (key, window_start, hits) values (p_key, bucket, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into count_now;
  -- Úklid starých oken (levné, index na window_start).
  delete from rate_limits where window_start < now() - interval '1 day';
  return count_now <= p_limit;
end;
$$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
