-- =============================================================================
-- Maps & charts for regions, global issues, topics and subtopics (owner, 2026-10-15)
-- =============================================================================
--
-- Until now only regions and global issues had visuals (`visual_embeds`:
-- Datawrapper charts and plain images, saved as a whole list through
-- replace_portrait_items('visuals')). Every content object gets them now —
-- one table, one admin editor, one carousel on the site:
--
--   1. `visuals`: one owner of four (owner_kind + exactly the matching key
--      column): a region (slug), a global issue (special_regions slug, both
--      follow a renamed slug), a topic (an entry of kind 'entry') or one of a
--      topic's subtopics (entry_chapters). Three kinds:
--        embed — an iframe from an allowed provider: `provider` and the
--                canonical `embed_url`, whose exact shape per provider is
--                checked here and in the app (src/lib/embeds.ts — the same
--                allowlist feeds the CSP frame-src). Pasted HTML is never stored;
--        image — a static picture (`image_url`), the old 'image' visuals;
--        map   — a custom map, `map_spec` (a JSON object of at most 200 kB,
--                validated in detail by the app's map module).
--      Title, caption, source label and link, a height hint for the frame.
--
--   2. Subtopics are saved by replace_entry_parts(), which deletes a topic's
--      subtopics and inserts them again with the same ids. As for the home
--      page pins (20261013000220) the subtopic key is checked at commit
--      (deferred) and a deferred trigger removes a subtopic's visuals only
--      when the subtopic is really gone at commit.
--
--   3. Who reads: anon reads the visuals of a public owner — regions and
--      global issues always, a topic's and its subtopics' only while the
--      topic is published; signed in, a draft topic's visuals like its other
--      parts (its editors and whoever reads unpublished articles).
--
--   4. Who writes (insert, update, delete — can_edit_visual()) follows who
--      edits the owner today:
--        region       — regions "e", or an article editor over all articles
--                       (news "e" + can_edit_entry(null); removing news "d"),
--                       the rule of the portrait texts until now;
--        global issue — specials "e", or the same article editor;
--        topic, subtopic — can_write_entry() of the topic: a draft by its
--                       editors, a pending or published topic only by who may
--                       approve it (#183: pending stays frozen).
--      Owner columns can't be changed after insert (no column grant).
--
--   5. move_visual(id, up): one place up or down within its owner (security
--      invoker — the update policy decides).
--
--   6. Data: every visual_embeds row is copied (same id): Datawrapper charts
--      as embeds, the rest — images, and the old Flourish / World Bank rows,
--      which the site showed as images — as images. portrait() reads
--      `visuals` from now on; its items keep `image` and `provider` beside
--      the new keys, so an app from before this migration still shows them.
--      visual_embeds stays in place, unused by the app from this release on;
--      a later contract migration drops it (and replace_portrait_items'
--      'visuals' branch).
--
-- Default privileges are revoked (20261013000210): every grant is explicit.
-- Tests: supabase/tests/visuals.test.mjs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table public.visuals (
  id           uuid primary key default gen_random_uuid(),
  owner_kind   text not null
    constraint visuals_owner_kind_check check (owner_kind in ('region', 'issue', 'entry', 'chapter')),
  region_slug  text references public.regions (slug) on delete cascade on update cascade,
  special_slug text references public.special_regions (slug) on delete cascade on update cascade,
  entry_id     uuid references public.entries (id) on delete cascade,
  chapter_id   uuid
    constraint visuals_chapter_id_fkey
    references public.entry_chapters (id) deferrable initially deferred,
  position     integer not null default 0
    constraint visuals_position_range check (position between 0 and 1000000),
  kind         text not null
    constraint visuals_kind_check check (kind in ('embed', 'image', 'map')),
  title        text not null
    constraint visuals_title_len check (length(title) <= 200 and length(btrim(title)) >= 1),
  caption      text not null default ''
    constraint visuals_caption_len check (length(caption) <= 600),
  source_label text not null default ''
    constraint visuals_source_label_len check (length(source_label) <= 120),
  source_url   text
    constraint visuals_source_url_check
    check (length(source_url) <= 1000 and source_url ~ '^https://[^[:space:]]+$'),
  provider     text
    constraint visuals_provider_check
    check (provider in ('datawrapper', 'flourish', 'owid', 'worldbank')),
  embed_url    text constraint visuals_embed_url_len check (length(embed_url) <= 1000),
  image_url    text
    constraint visuals_image_url_check
    check (length(image_url) <= 1000 and image_url ~ '^https://[^[:space:]]+$'),
  -- Height of the frame in px; null = the provider's own (or its resize message).
  height       integer constraint visuals_height_range check (height between 200 and 1600),
  map_spec     jsonb
    constraint visuals_map_spec_check
    check (jsonb_typeof(map_spec) = 'object' and octet_length(map_spec::text) <= 204800),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Exactly one owner, the one owner_kind names.
  constraint visuals_one_owner check (
    num_nonnulls(region_slug, special_slug, entry_id, chapter_id) = 1
    and case owner_kind
          when 'region' then region_slug is not null
          when 'issue' then special_slug is not null
          when 'entry' then entry_id is not null
          when 'chapter' then chapter_id is not null
          else false
        end),

  -- Each kind carries its own content and nothing else.
  constraint visuals_kind_fields check (
    case kind
      when 'embed' then provider is not null and embed_url is not null
                        and image_url is null and map_spec is null
      when 'image' then image_url is not null
                        and provider is null and embed_url is null and map_spec is null
      when 'map' then map_spec is not null
                      and provider is null and embed_url is null and image_url is null
      else false
    end),

  -- The canonical embed URL of each provider — the same patterns as
  -- canonicalEmbedUrl() in src/lib/embeds.ts: exact host and path, a query
  -- only where the provider needs one (chart settings), no fragment, no
  -- credentials, no spaces or quotes.
  constraint visuals_embed_url_check check (
    embed_url is null
    or case provider
         when 'datawrapper' then
           embed_url ~ '^https://datawrapper\.dwcdn\.net/[A-Za-z0-9]{4,16}/([0-9]{1,4}/)?$'
         when 'flourish' then
           embed_url ~ '^https://flo\.uri\.sh/(visualisation|story)/[0-9]{1,12}/embed$'
         when 'owid' then
           embed_url ~ '^https://ourworldindata\.org/grapher/[a-z0-9]+(-[a-z0-9]+)*(\?[A-Za-z0-9_.~%=&+,:-]+)?$'
         when 'worldbank' then
           embed_url ~ '^https://data\.worldbank\.org/share/widget\?[A-Za-z0-9_.~%=&+,:-]+$'
         else false
       end)
);

-- Foreign key indexes, in display order.
create index visuals_region on public.visuals (region_slug, position);
create index visuals_special on public.visuals (special_slug, position);
create index visuals_entry on public.visuals (entry_id, position);
create index visuals_chapter on public.visuals (chapter_id, position);

create trigger visuals_stamp
  before update on public.visuals
  for each row execute function public.stamp_row();

-- A map's spec can be 200 kB: kept out of the audit log (that it changed shows
-- by updated_at; the row's other columns are logged).
create trigger visuals_audit
  after insert or update or delete on public.visuals
  for each row execute function public.audit_row('id', 'map_spec');

-- A topic's visuals: only entries of kind 'entry' (news have none). Security
-- definer: the kind is checked whether or not the writer may read the entry.
create or replace function public.visuals_topic_only()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from entries e where e.id = new.entry_id and e.kind = 'entry') then
    raise exception 'Only a topic has maps and charts.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.visuals_topic_only() from public, anon, authenticated;

create trigger visuals_topic_only
  before insert or update of entry_id on public.visuals
  for each row when (new.entry_id is not null)
  execute function public.visuals_topic_only();

-- ---------------------------------------------------------------------------
-- 2. A subtopic removed for good takes its visuals along
-- ---------------------------------------------------------------------------
-- Runs at commit, when replace_entry_parts has put a re-saved subtopic back.
-- Security definer: whoever deletes the subtopic may delete its visuals
-- (the same can_write_entry right), but the check must not depend on it.

create or replace function public.drop_visuals_of_removed_chapter()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from entry_chapters where id = old.id) then
    delete from visuals where chapter_id = old.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.drop_visuals_of_removed_chapter() from public, anon, authenticated;

-- Deferred triggers of one row fire in name order, and the foreign key's own
-- check is a trigger named "RI_ConstraintTrigger_…": this one must sort before
-- it (upper-case "A") so the visuals are gone before the key is checked.
create constraint trigger "A_visuals_drop_removed_chapter"
  after delete on public.entry_chapters
  deferrable initially deferred
  for each row execute function public.drop_visuals_of_removed_chapter();

-- ---------------------------------------------------------------------------
-- 3.–4. Who reads and who writes
-- ---------------------------------------------------------------------------

-- The topic a visual belongs to (its own, or its subtopic's); null for a
-- region or global issue. Security definer: a subtopic's topic is found
-- whether or not the caller may read the subtopic row itself.
create or replace function public.visual_entry(p_entry uuid, p_chapter uuid)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(p_entry, (select c.entry_id from entry_chapters c where c.id = p_chapter));
$$;

revoke execute on function public.visual_entry(uuid, uuid) from public, anon;
grant execute on function public.visual_entry(uuid, uuid) to authenticated;

-- May the signed-in user add or change ('e') or remove ('d') this owner's
-- visuals? Exactly one owner argument is set (as in a row).
create or replace function public.can_edit_visual(
  p_region text, p_special text, p_entry uuid, p_chapter uuid, p_action text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when p_region is not null then
      has_perm('regions', 'e')
      or (has_perm('news', case when p_action = 'd' then 'd' else 'e' end) and can_edit_entry(null))
    when p_special is not null then
      has_perm('specials', 'e')
      or (has_perm('news', case when p_action = 'd' then 'd' else 'e' end) and can_edit_entry(null))
    when p_entry is not null or p_chapter is not null then
      coalesce(can_write_entry(visual_entry(p_entry, p_chapter)), false)
    else false
  end;
$$;

revoke execute on function public.can_edit_visual(text, text, uuid, uuid, text) from public, anon;
grant execute on function public.can_edit_visual(text, text, uuid, uuid, text) to authenticated;

alter table public.visuals enable row level security;

-- Regions and global issues are public; a topic's and its subtopics' visuals
-- only while the topic is published.
create policy visuals_public on public.visuals for select to anon
  using (owner_kind in ('region', 'issue')
         or exists (select 1 from public.entries e
                     where e.id = entry_id and e.status = 'published')
         or exists (select 1 from public.entry_chapters c
                      join public.entries e on e.id = c.entry_id
                     where c.id = chapter_id and e.status = 'published'));
create policy visuals_read on public.visuals for select to authenticated
  using (owner_kind in ('region', 'issue')
         or (select public.can_read_any_unpublished())
         or public.entry_published_or_own(public.visual_entry(entry_id, chapter_id)));

create policy visuals_add on public.visuals for insert to authenticated
  with check (public.can_edit_visual(region_slug, special_slug, entry_id, chapter_id, 'e'));
create policy visuals_change on public.visuals for update to authenticated
  using (public.can_edit_visual(region_slug, special_slug, entry_id, chapter_id, 'e'))
  with check (public.can_edit_visual(region_slug, special_slug, entry_id, chapter_id, 'e'));
create policy visuals_remove on public.visuals for delete to authenticated
  using (public.can_edit_visual(region_slug, special_slug, entry_id, chapter_id, 'd'));

-- Explicit grants; RLS narrows them. The public needs no timestamps of creation.
revoke all on public.visuals from anon, authenticated;
grant select (id, owner_kind, region_slug, special_slug, entry_id, chapter_id, position, kind,
              title, caption, source_label, source_url, provider, embed_url, image_url, height,
              map_spec, updated_at)
  on public.visuals to anon;
grant select on public.visuals to authenticated;
grant insert (owner_kind, region_slug, special_slug, entry_id, chapter_id, position, kind,
              title, caption, source_label, source_url, provider, embed_url, image_url, height,
              map_spec)
  on public.visuals to authenticated;
-- The owner stays: a visual moves to another owner only by being added there.
grant update (position, kind, title, caption, source_label, source_url, provider, embed_url,
              image_url, height, map_spec)
  on public.visuals to authenticated;
grant delete on public.visuals to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Order
-- ---------------------------------------------------------------------------
-- Moves one visual up or down among its owner's: renumbers them (10, 20, …)
-- with the two swapped, in one transaction. Security invoker — the update
-- policy decides; without the right nothing changes and the call is refused.

create or replace function public.move_visual(p_id uuid, p_up boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v       visuals%rowtype;
  ids     uuid[];
  i       integer;
  j       integer;
  changed integer;
begin
  select * into v from visuals where id = p_id;
  if not found then
    raise exception 'The map or chart is no longer there.' using errcode = '22023';
  end if;
  select array_agg(x.id order by x.position, x.id) into ids
    from visuals x
   where x.region_slug is not distinct from v.region_slug
     and x.special_slug is not distinct from v.special_slug
     and x.entry_id is not distinct from v.entry_id
     and x.chapter_id is not distinct from v.chapter_id;
  i := array_position(ids, p_id);
  j := case when p_up then i - 1 else i + 1 end;
  if j < 1 or j > cardinality(ids) then
    return;  -- already first / last
  end if;
  ids[i] := ids[j];
  ids[j] := p_id;
  update visuals x
     set position = o.pos * 10
    from unnest(ids) with ordinality as o (id, pos)
   where x.id = o.id and x.position is distinct from o.pos * 10;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'You can''t reorder these maps and charts.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.move_visual(uuid, boolean) from public, anon;
grant execute on function public.move_visual(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Data from visual_embeds, and portrait() reading the new table
-- ---------------------------------------------------------------------------
-- Datawrapper charts become embeds (their URL already has the canonical
-- shape), everything else an image, as the site showed it. A row that doesn't
-- meet the new checks (an image URL with a space) stays only in visual_embeds.

insert into public.visuals (id, owner_kind, region_slug, special_slug, position, kind, title,
                            caption, provider, embed_url, image_url)
select v.id,
       case when v.region_slug is not null then 'region' else 'issue' end,
       v.region_slug, v.special_slug, v.position,
       case when v.provider = 'datawrapper' then 'embed' else 'image' end,
       coalesce(nullif(btrim(v.title), ''), 'Map'),
       v.caption,
       case when v.provider = 'datawrapper' then 'datawrapper' end,
       case when v.provider = 'datawrapper' then v.url end,
       case when v.provider <> 'datawrapper' then v.url end
  from public.visual_embeds v
 where length(v.url) <= 1000
   and v.position between 0 and 1000000
   and length(v.caption) <= 600
   and length(v.title) <= 200
   and case when v.provider = 'datawrapper'
            then v.url ~ '^https://datawrapper\.dwcdn\.net/[A-Za-z0-9]{4,16}/([0-9]{1,4}/)?$'
            else v.url ~ '^https://[^[:space:]]+$' end
on conflict (id) do nothing;

-- Body as in 20261015000060; only the visuals come from `visuals` now, with
-- the new keys and, for an app from before this migration, `image` (the frame
-- or picture URL) and `provider`.
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
      select jsonb_agg(jsonb_build_object('id', v.id, 'kind', v.kind, 'title', v.title,
                                          'caption', v.caption, 'source_label', v.source_label,
                                          'source_url', v.source_url, 'provider', v.provider,
                                          'embed_url', v.embed_url, 'image_url', v.image_url,
                                          'height', v.height, 'map_spec', v.map_spec,
                                          'image', coalesce(v.embed_url, v.image_url))
                       order by v.position, v.id)
      from visuals v
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
