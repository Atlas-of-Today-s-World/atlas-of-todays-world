-- =============================================================================
-- hit_rate_limit(): no table-wide cleanup on every call (review 2026-10-07, D-L2)
-- =============================================================================
--
-- Every rate-limited request also ran
--   delete from rate_limits where window_start < now() - interval '1 day'
-- over the whole table, so concurrent requests competed for the same expired
-- rows. Since 20261008000060 the daily pg_cron job db_housekeeping() removes
-- expired windows of all keys; the call itself now tidies only the caller's
-- own key (primary key range, no contention between keys). The answer — is
-- this hit still within the limit of the current window — is unchanged.
-- =============================================================================

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
  -- Only this key's expired windows; the rest goes in db_housekeeping().
  delete from rate_limits where key = p_key and window_start < now() - interval '1 day';
  return count_now <= p_limit;
end;
$$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
