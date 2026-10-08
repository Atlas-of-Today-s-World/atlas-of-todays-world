-- =============================================================================
-- Internal content metadata stays with the team; portrait sections check rights first
-- =============================================================================
--
-- 1. Readers (self-registered accounts) read the public site the way anon does —
--    through the public client. Through their own session they now see only
--    their own entries, so who wrote, approved and scheduled an entry
--    (owner_id, approved_by, approved_at, scheduled_by, publish_at) is visible
--    to active team members only. Column grants alone can't do this for
--    `entries`: the policies of its child tables read `entries.owner_id` as the
--    caller, so the column must stay readable by `authenticated`.
-- 2. `authors.profile_id` (which team account an author profile belongs to) is
--    no longer readable by `authenticated` at all (the admin never reads it);
--    only the policy on the same table compares it.
-- 3. replace_portrait_items() refuses a caller without the right to edit the
--    section up front. Before, an empty list from anyone removed nothing under
--    RLS and still "succeeded", so the app refreshed public caches for nothing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Published entries through a session: team only
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select is_active() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.kind = 'staff'
  );
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

drop policy entries_read on public.entries;
create policy entries_read on public.entries for select to authenticated
  using ((status = 'published' and (select public.is_staff())) or can_read_unpublished(owner_id));

-- ---------------------------------------------------------------------------
-- 2. Author profiles: the linked account only for the database itself
-- ---------------------------------------------------------------------------

revoke select on public.authors from authenticated;
grant select (id, name, slug, photo_url, bio, positionality, created_at)
  on public.authors to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Portrait sections: the right to edit is checked before anything changes
-- ---------------------------------------------------------------------------

create or replace function public.replace_portrait_items(
  p_kind text, p_slug text, p_collection text, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_region  text := case when p_kind = 'region' then p_slug end;
  v_special text := case when p_kind = 'issue' then p_slug end;
  v_country text := case when p_kind = 'country' then p_slug end;
begin
  if p_kind not in ('region', 'issue', 'country') or (p_kind = 'country' and p_collection <> 'metrics') then
    raise exception 'Unknown portrait.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'A portrait section holds at most 50 items.' using errcode = '22023';
  end if;
  -- The same rights as the insert policies of the section tables.
  if not (case when p_collection = 'metrics' then public.can_edit_portrait_metric(v_special)
               else public.has_perm('news', 'e') and public.can_edit_entry(null) end) then
    raise exception 'You may not edit this portrait.' using errcode = '42501';
  end if;

  case p_collection
  when 'timeline' then
    delete from timeline_events
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into timeline_events (region_slug, special_slug, position, date_label, title, body, image_url)
    select v_region, v_special, (ord - 1)::int, i ->> 'date_label', i ->> 'title',
           coalesce(i ->> 'body', ''), nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'faq' then
    delete from faq_items
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into faq_items (region_slug, special_slug, position, question, answer)
    select v_region, v_special, (ord - 1)::int, i ->> 'question', i ->> 'answer'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'resources' then
    delete from resources
     where entry_id is null
       and region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into resources (region_slug, special_slug, position, kind, title, source, description, url, image_url)
    select v_region, v_special, (ord - 1)::int, i ->> 'kind', i ->> 'title', coalesce(i ->> 'source', ''),
           coalesce(i ->> 'description', ''), i ->> 'url', nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'visuals' then
    delete from visual_embeds
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into visual_embeds (region_slug, special_slug, position, provider, title, caption, url)
    select v_region, v_special, (ord - 1)::int, i ->> 'provider', i ->> 'title',
           coalesce(i ->> 'caption', ''), i ->> 'url'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'metrics' then
    delete from portrait_metrics
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and country_iso3 is not distinct from v_country;
    insert into portrait_metrics (region_slug, special_slug, country_iso3, position, value, label,
                                  description, source, source_url, period)
    select v_region, v_special, v_country, (ord - 1)::int, i ->> 'value', i ->> 'label',
           coalesce(i ->> 'description', ''), i ->> 'source', nullif(i ->> 'source_url', ''),
           nullif(i ->> 'period', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  else
    raise exception 'Unknown portrait section.' using errcode = '22023';
  end case;
end;
$$;

revoke execute on function public.replace_portrait_items(text, text, text, jsonb) from public, anon;
grant execute on function public.replace_portrait_items(text, text, text, jsonb) to authenticated;
