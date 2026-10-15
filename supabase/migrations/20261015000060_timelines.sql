-- =============================================================================
-- Timelines for regions, global issues, countries and topics (owner, 2026-10-15)
-- =============================================================================
--
-- The original site told each portrait's history as a horizontal timeline:
-- events with a title, a date, a rich text cut after ten lines ("More") and
-- the sources it rests on. `timeline_events` so far belonged to a region or a
-- global issue and held only plain text. Now:
--
--   1. One owner of four: region_slug | special_slug | country_iso3 | entry_id
--      (a topic — an entry of kind 'entry'), exactly one of them.
--   2. body_html (rich text, sanitized by the app on save and on render like
--      every editorial HTML) and sources (a JSON list of {title, url}, https
--      only, checked by timeline_sources_valid()). `body` stays: the app writes
--      the plain text of body_html into it (search, structured data) and shows
--      it where body_html is empty (rows from before, the seed).
--   3. The timeline's title and subtitle per owner: regions and special_regions
--      had them already, countries and entries get the same two columns.
--   4. Who may edit a timeline is who may edit that owner's texts — the rules
--      the region / issue timeline already had, extended to the new owners:
--        region, global issue — article editors with scope over all articles
--                               (news "e" + can_edit_entry(null)); removing
--                               events news "d" (unchanged);
--        country              — whoever edits the country profile (regions "e");
--                               saving the list is one step, so removing needs
--                               "e" too (the data editor role has no "d");
--        topic                — whoever may write the topic's parts
--                               (can_write_entry: drafts by their editors,
--                               pending / published by an approver).
--      Anon reads a topic's events only when the topic is published; the
--      team the same way as the topic's other parts (unpublished_reads).
--   5. replace_timeline(): the whole timeline with its title and subtitle in
--      one transaction, rights checked once like replace_portrait_items().
--      It writes the owner's title columns itself (security definer), so an
--      editor of region texts sets the timeline heading without the right to
--      edit the region's other fields.
--   6. portrait() returns each event's html and sources as well (an old app
--      ignores the new keys).
--
-- Backward compatible: columns are added with defaults, the old app's
-- replace_portrait_items('timeline') still writes region / issue events.
--
-- Safe to run twice: atlas-dev first got it as 20261015000050, then it was
-- renamed to sort after 20261015000050_global_issues_nav, which production
-- has. Columns, indexes, constraints, the trigger and the policies are
-- (re)created only as needed, functions are replaced.
-- Tests: supabase/tests/timelines.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.–2. Owners, rich text and sources
-- ---------------------------------------------------------------------------

-- A list of at most 20 sources, each exactly {title, url}: a title of 1–300
-- characters and an https URL without spaces of at most 1000 characters.
create or replace function public.timeline_sources_valid(p_sources jsonb)
returns boolean
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  source jsonb;
begin
  if jsonb_typeof(p_sources) is distinct from 'array' or jsonb_array_length(p_sources) > 20 then
    return false;
  end if;
  for source in select value from jsonb_array_elements(p_sources) loop
    if jsonb_typeof(source) is distinct from 'object'
       or (source - 'title' - 'url') <> '{}'::jsonb
       or jsonb_typeof(source -> 'title') is distinct from 'string'
       or jsonb_typeof(source -> 'url') is distinct from 'string'
       or length(btrim(source ->> 'title')) not between 1 and 300
       or length(source ->> 'url') > 1000
       or (source ->> 'url') !~ '^https://[^[:space:]]+$' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke execute on function public.timeline_sources_valid(jsonb) from public;
grant execute on function public.timeline_sources_valid(jsonb) to anon, authenticated, service_role;

alter table public.timeline_events
  add column if not exists country_iso3 text
    references public.countries (iso3) on delete cascade on update cascade,
  add column if not exists entry_id uuid references public.entries (id) on delete cascade,
  add column if not exists body_html text not null default '',
  add column if not exists sources jsonb not null default '[]'::jsonb;

-- The table's first CHECK (region xor issue), named by Postgres.
alter table public.timeline_events
  drop constraint if exists timeline_events_check,
  drop constraint if exists timeline_events_one_owner,
  drop constraint if exists timeline_events_body_html_len,
  drop constraint if exists timeline_events_sources_valid;
alter table public.timeline_events
  add constraint timeline_events_one_owner
    check (num_nonnulls(region_slug, special_slug, country_iso3, entry_id) = 1),
  add constraint timeline_events_body_html_len check (length(body_html) <= 20000),
  add constraint timeline_events_sources_valid check (public.timeline_sources_valid(sources));

create index if not exists timeline_events_country on public.timeline_events (country_iso3, position);
create index if not exists timeline_events_entry on public.timeline_events (entry_id, position);

-- A topic's timeline: only entries of kind 'entry' (news and the like have none).
-- Security definer: the kind is checked whether or not the writer may read the
-- entry (the row policies decide who may write).
create or replace function public.timeline_events_topic_only()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.entry_id is not null
     and not exists (select 1 from entries e where e.id = new.entry_id and e.kind = 'entry') then
    raise exception 'Only a topic has a timeline.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.timeline_events_topic_only() from public, anon, authenticated;

drop trigger if exists timeline_events_topic_only on public.timeline_events;
create trigger timeline_events_topic_only
  before insert or update of entry_id on public.timeline_events
  for each row when (new.entry_id is not null)
  execute function public.timeline_events_topic_only();

-- ---------------------------------------------------------------------------
-- 3. Title and subtitle of a country's and a topic's timeline
-- ---------------------------------------------------------------------------
-- The same limits as regions / special_regions (20261013000105).

alter table public.countries
  add column if not exists timeline_title text
    constraint countries_timeline_title_len check (length(timeline_title) <= 120),
  add column if not exists timeline_subtitle text
    constraint countries_timeline_subtitle_len check (length(timeline_subtitle) <= 300);

alter table public.entries
  add column if not exists timeline_title text
    constraint entries_timeline_title_len check (length(timeline_title) <= 120),
  add column if not exists timeline_subtitle text
    constraint entries_timeline_subtitle_len check (length(timeline_subtitle) <= 300);

-- countries keep their table-wide grants; anon reads entries column by column.
grant select (timeline_title, timeline_subtitle) on public.entries to anon;

-- ---------------------------------------------------------------------------
-- 4. Who reads and who edits
-- ---------------------------------------------------------------------------

-- May the signed-in user edit ('e') or remove events of ('d') this owner's
-- timeline? Exactly one owner argument is set (as in a row). Security definer
-- like the helpers it calls, so the policies stay one call per row.
create or replace function public.can_edit_timeline(
  p_region text, p_special text, p_country text, p_entry uuid, p_action text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when p_region is not null or p_special is not null then
      has_perm('news', case when p_action = 'd' then 'd' else 'e' end) and can_edit_entry(null)
    when p_country is not null then has_perm('regions', 'e')
    when p_entry is not null then can_write_entry(p_entry)
    else false
  end;
$$;

revoke execute on function public.can_edit_timeline(text, text, text, uuid, text) from public, anon;
grant execute on function public.can_edit_timeline(text, text, text, uuid, text) to authenticated;

drop policy if exists timeline_public on public.timeline_events;
drop policy if exists timeline_read on public.timeline_events;
drop policy if exists timeline_add on public.timeline_events;
drop policy if exists timeline_change on public.timeline_events;
drop policy if exists timeline_remove on public.timeline_events;

-- Regions, issues and countries are public; a topic's events only once it is.
create policy timeline_public on public.timeline_events for select to anon
  using (entry_id is null
         or exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published'));
create policy timeline_read on public.timeline_events for select to authenticated
  using (entry_id is null
         or (select public.can_read_any_unpublished())
         or public.entry_published_or_own(entry_id));

create policy timeline_add on public.timeline_events for insert to authenticated
  with check (public.can_edit_timeline(region_slug, special_slug, country_iso3, entry_id, 'e'));
create policy timeline_change on public.timeline_events for update to authenticated
  using (public.can_edit_timeline(region_slug, special_slug, country_iso3, entry_id, 'e'))
  with check (public.can_edit_timeline(region_slug, special_slug, country_iso3, entry_id, 'e'));
create policy timeline_remove on public.timeline_events for delete to authenticated
  using (public.can_edit_timeline(region_slug, special_slug, country_iso3, entry_id, 'd'));

-- ---------------------------------------------------------------------------
-- 5. Saving a whole timeline
-- ---------------------------------------------------------------------------
-- p_kind: 'region' | 'issue' | 'country' | 'topic'; p_key: the region / issue
-- slug, the country's ISO3 code or the topic's id. Each event:
-- {date_label, title, body, body_html, sources, image_url?}. Empty title or
-- subtitle = the default heading.

create or replace function public.replace_timeline(
  p_kind text, p_key text, p_title text, p_subtitle text, p_events jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_region  text;
  v_special text;
  v_country text;
  v_entry   uuid;
  v_title    text := nullif(btrim(coalesce(p_title, '')), '');
  v_subtitle text := nullif(btrim(coalesce(p_subtitle, '')), '');
begin
  case p_kind
  when 'region' then
    select slug into v_region from regions where slug = p_key;
  when 'issue' then
    select slug into v_special from special_regions where slug = p_key;
  when 'country' then
    select iso3 into v_country from countries where iso3 = p_key;
  when 'topic' then
    if p_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select id into v_entry from entries where id = p_key::uuid and kind = 'entry';
    end if;
  else
    null;
  end case;
  if num_nonnulls(v_region, v_special, v_country, v_entry) <> 1 then
    raise exception 'Unknown timeline.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) > 60 then
    raise exception 'A timeline holds at most 60 events.' using errcode = '22023';
  end if;
  -- The insert and update policies.
  if not public.can_edit_timeline(v_region, v_special, v_country, v_entry, 'e') then
    raise exception 'You may not edit this timeline.' using errcode = '42501';
  end if;
  -- The delete policy: without it the old events would stay next to the new ones.
  if exists (select 1 from timeline_events t
              where t.region_slug = v_region or t.special_slug = v_special
                 or t.country_iso3 = v_country or t.entry_id = v_entry)
     and not public.can_edit_timeline(v_region, v_special, v_country, v_entry, 'd') then
    raise exception 'You may not remove timeline events.' using errcode = '42501';
  end if;

  delete from timeline_events t
   where t.region_slug = v_region or t.special_slug = v_special
      or t.country_iso3 = v_country or t.entry_id = v_entry;
  insert into timeline_events (region_slug, special_slug, country_iso3, entry_id, position,
                               date_label, title, body, body_html, sources, image_url)
  select v_region, v_special, v_country, v_entry, (ord - 1)::int,
         i ->> 'date_label', i ->> 'title', coalesce(i ->> 'body', ''),
         coalesce(i ->> 'body_html', ''), coalesce(i -> 'sources', '[]'::jsonb),
         nullif(i ->> 'image_url', '')
  from jsonb_array_elements(p_events) with ordinality as t(i, ord);

  -- The heading, only where it changed (no audit or revision for nothing).
  if v_region is not null then
    update regions set timeline_title = v_title, timeline_subtitle = v_subtitle
     where slug = v_region
       and (timeline_title, timeline_subtitle) is distinct from (v_title, v_subtitle);
  elsif v_special is not null then
    update special_regions set timeline_title = v_title, timeline_subtitle = v_subtitle
     where slug = v_special
       and (timeline_title, timeline_subtitle) is distinct from (v_title, v_subtitle);
  elsif v_country is not null then
    update countries set timeline_title = v_title, timeline_subtitle = v_subtitle
     where iso3 = v_country
       and (timeline_title, timeline_subtitle) is distinct from (v_title, v_subtitle);
  else
    update entries set timeline_title = v_title, timeline_subtitle = v_subtitle
     where id = v_entry
       and (timeline_title, timeline_subtitle) is distinct from (v_title, v_subtitle);
  end if;
end;
$$;

revoke execute on function public.replace_timeline(text, text, text, text, jsonb) from public, anon;
grant execute on function public.replace_timeline(text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. portrait(): events with their rich text and sources
-- ---------------------------------------------------------------------------
-- Body as in 20261008000020; only the timeline items gain `html` and `sources`.

create or replace function public.portrait(p_kind text, p_slug text)
returns jsonb
language sql stable
set search_path = public, pg_temp
as $$
  with head as (
    select r.intro, r.timeline_title, r.timeline_subtitle
    from regions r where p_kind = 'region' and r.slug = p_slug
    union all
    select s.intro, s.timeline_title, s.timeline_subtitle
    from special_regions s where p_kind = 'issue' and s.slug = p_slug
  )
  select jsonb_build_object(
    'intro', head.intro,
    'timelineTitle', head.timeline_title,
    'timelineSubtitle', head.timeline_subtitle,
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object('date', t.date_label, 'title', t.title, 'text', t.body,
                                          'html', t.body_html, 'sources', t.sources)
                       order by t.position)
      from timeline_events t
      where (p_kind = 'region' and t.region_slug = p_slug) or (p_kind = 'issue' and t.special_slug = p_slug)
    ), '[]'::jsonb),
    'faq', coalesce((
      select jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer) order by f.position)
      from faq_items f
      where (p_kind = 'region' and f.region_slug = p_slug) or (p_kind = 'issue' and f.special_slug = p_slug)
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object('title', x.title, 'source', x.source, 'url', x.url,
                                          'image', x.image_url, 'kind', x.kind) order by x.position)
      from resources x
      where (p_kind = 'region' and x.region_slug = p_slug) or (p_kind = 'issue' and x.special_slug = p_slug)
    ), '[]'::jsonb),
    'visuals', coalesce((
      select jsonb_agg(jsonb_build_object('title', v.title, 'image', v.url, 'caption', v.caption,
                                          'provider', v.provider)
                       order by v.position)
      from visual_embeds v
      where (p_kind = 'region' and v.region_slug = p_slug) or (p_kind = 'issue' and v.special_slug = p_slug)
    ), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object('value', m.value, 'label', m.label, 'description', m.description,
                                          'source', m.source, 'sourceUrl', m.source_url,
                                          'year', coalesce(m.period, m.year::text))
                       order by m.position)
      from portrait_metrics m
      where (p_kind = 'region' and m.region_slug = p_slug) or (p_kind = 'issue' and m.special_slug = p_slug)
    ), '[]'::jsonb)
  )
  from head;
$$;

revoke execute on function public.portrait(text, text) from public;
grant execute on function public.portrait(text, text) to anon, authenticated;
