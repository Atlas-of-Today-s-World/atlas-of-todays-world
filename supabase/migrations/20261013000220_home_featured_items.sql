-- =============================================================================
-- Home map "Latest subtopics": an ordered list of pins and a tile count
-- =============================================================================
--
-- Until now two fixed slots (home_featured.first_chapter / second_chapter).
-- Now (expand step):
--
-- 1. home_featured_items — the subtopics the editors pinned, in their order
--    (position 10, 20, …). Each subtopic at most once. The home map shows the
--    pins first, then fills the rest with the newest subtopics (the app).
-- 2. home_settings — one row: how many tiles the home map shows (1–6, default 2).
-- 3. The two current pins are copied into the list, so nothing visible changes.
--
-- home_featured stays in place, unused by the app from this release on; a
-- later contract migration drops it.
--
-- Rights: the home page belongs to the `news` section (its editors pinned the
-- slots so far) and to `site` (site content) — "e" in either is enough to
-- change the count and to add, reorder or remove a pin (pinning is editing one
-- page, not creating content). Everyone reads both tables.
--
-- Subtopics are saved by replace_entry_parts, which deletes a topic's
-- subtopics and inserts them again with the same ids. A plain
-- `on delete cascade` would therefore drop a pin every time its topic is
-- saved (home_featured lost its slots that way: `on delete set null`). So the
-- foreign key is checked at commit (deferred) and a deferred trigger removes
-- the pin only when the subtopic is really gone at commit.
-- =============================================================================

create table public.home_featured_items (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null
    constraint home_featured_items_chapter_id_fkey
    references public.entry_chapters (id) deferrable initially deferred,
  position    integer not null check (position between 0 and 100000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Also the index of the foreign key.
  constraint home_featured_items_chapter_key unique (chapter_id)
);

create index home_featured_items_position on public.home_featured_items (position, id);

create trigger home_featured_items_stamp
  before update on public.home_featured_items
  for each row execute function public.stamp_row();

create trigger home_featured_items_audit
  after insert or update or delete on public.home_featured_items
  for each row execute function public.audit_row('chapter_id');

-- A subtopic deleted for good (removed from its topic, or the topic deleted)
-- leaves the list. Runs at commit, when replace_entry_parts has put a re-saved
-- subtopic back. Security definer: whoever deletes the subtopic need not hold
-- the home page right.
create or replace function public.unpin_removed_chapter()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from entry_chapters where id = old.id) then
    delete from home_featured_items where chapter_id = old.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.unpin_removed_chapter() from public, anon, authenticated;

-- Deferred triggers of one row fire in name order, and the foreign key's own
-- check is a trigger named "RI_ConstraintTrigger_…": this one must sort before
-- it (upper-case "A") so the pin is gone before the key is checked.
create constraint trigger "A_home_featured_unpin"
  after delete on public.entry_chapters
  deferrable initially deferred
  for each row execute function public.unpin_removed_chapter();

alter table public.home_featured_items enable row level security;

create policy home_featured_items_read on public.home_featured_items for select to anon, authenticated
  using (true);
create policy home_featured_items_add on public.home_featured_items for insert to authenticated
  with check ((select public.has_perm('site', 'e')) or (select public.has_perm('news', 'e')));
create policy home_featured_items_change on public.home_featured_items for update to authenticated
  using ((select public.has_perm('site', 'e')) or (select public.has_perm('news', 'e')))
  with check ((select public.has_perm('site', 'e')) or (select public.has_perm('news', 'e')));
create policy home_featured_items_remove on public.home_featured_items for delete to authenticated
  using ((select public.has_perm('site', 'e')) or (select public.has_perm('news', 'e')));

-- Explicit grants (no reliance on Supabase's default privileges); RLS narrows
-- them. The public needs no timestamps; the admin list does.
revoke all on public.home_featured_items from anon, authenticated;
grant select (id, chapter_id, position) on public.home_featured_items to anon;
grant select (id, chapter_id, position, created_at, updated_at)
  on public.home_featured_items to authenticated;
grant insert (chapter_id, position) on public.home_featured_items to authenticated;
grant update (position) on public.home_featured_items to authenticated;
grant delete on public.home_featured_items to authenticated;

-- Moves one pin up or down: renumbers the list (10, 20, …) with the two
-- swapped, in one transaction. Security invoker — the update policy decides;
-- without the right nothing changes and the call is refused.
create or replace function public.move_home_featured_item(p_id uuid, p_up boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  ids uuid[];
  i integer;
  j integer;
  changed integer;
begin
  select array_agg(id order by position, id) into ids from home_featured_items;
  i := array_position(ids, p_id);
  if i is null then
    raise exception 'The pinned subtopic is no longer in the list.' using errcode = '22023';
  end if;
  j := case when p_up then i - 1 else i + 1 end;
  if j < 1 or j > cardinality(ids) then
    return;  -- already first / last
  end if;
  ids[i] := ids[j];
  ids[j] := p_id;
  update home_featured_items f
     set position = o.pos * 10
    from unnest(ids) with ordinality as o (id, pos)
   where f.id = o.id and f.position is distinct from o.pos * 10;
  get diagnostics changed = row_count;
  if changed = 0 then
    raise exception 'You can''t reorder the home page subtopics.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.move_home_featured_item(uuid, boolean) from public, anon;
grant execute on function public.move_home_featured_item(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- How many tiles the home map shows
-- ---------------------------------------------------------------------------

create table public.home_settings (
  id              integer primary key default 1 check (id = 1),
  featured_count  integer not null default 2 check (featured_count between 1 and 6),
  updated_at      timestamptz not null default now()
);
insert into public.home_settings default values;

create trigger home_settings_stamp
  before update on public.home_settings
  for each row execute function public.stamp_row();

create trigger home_settings_audit
  after update on public.home_settings
  for each row execute function public.audit_row('id');

alter table public.home_settings enable row level security;

create policy home_settings_read on public.home_settings for select to anon, authenticated
  using (true);
create policy home_settings_change on public.home_settings for update to authenticated
  using ((select public.has_perm('site', 'e')) or (select public.has_perm('news', 'e')))
  with check ((select public.has_perm('site', 'e')) or (select public.has_perm('news', 'e')));

-- Every column is public; only the count may be changed; nobody adds or removes the row.
revoke all on public.home_settings from anon, authenticated;
grant select (id, featured_count, updated_at) on public.home_settings to anon, authenticated;
grant update (featured_count) on public.home_settings to authenticated;

comment on table public.home_featured is
  'Unused since migration 20261013000220 (home_featured_items, home_settings); to be dropped by a contract migration.';

-- ---------------------------------------------------------------------------
-- The two slots as they are now, copied into the list in their order. Last,
-- and with the key checked at once: a pending deferred check blocks any later
-- ALTER of the table in the same transaction.
-- ---------------------------------------------------------------------------

set constraints public.home_featured_items_chapter_id_fkey immediate;

insert into public.home_featured_items (chapter_id, position)
select slot.chapter_id, slot.position
from public.home_featured h
cross join lateral (values (h.first_chapter, 10), (h.second_chapter, 20)) as slot (chapter_id, position)
where h.id = 1 and slot.chapter_id is not null
on conflict (chapter_id) do nothing;

set constraints public.home_featured_items_chapter_id_fkey deferred;
