-- Subtopics featured on the home map, under the search field. Two slots the
-- editors may pin by hand in the admin; an empty slot shows the newest
-- subtopic instead (decided by the app). Public: the home page reads it.

create table public.home_featured (
  id             integer primary key default 1 check (id = 1),
  first_chapter  uuid references public.entry_chapters (id) on delete set null,
  second_chapter uuid references public.entry_chapters (id) on delete set null,
  updated_at     timestamptz not null default now(),
  check (first_chapter is null or second_chapter is null or first_chapter <> second_chapter)
);
insert into public.home_featured default values;

create index home_featured_first_chapter on public.home_featured (first_chapter);
create index home_featured_second_chapter on public.home_featured (second_chapter);

create trigger home_featured_stamp
  before update on public.home_featured
  for each row execute function public.stamp_row();

create trigger home_featured_audit
  after update on public.home_featured
  for each row execute function public.audit_row('id');

alter table public.home_featured enable row level security;

create policy home_featured_public on public.home_featured for select to anon, authenticated
  using (true);
create policy home_featured_change on public.home_featured for update to authenticated
  using (has_perm('news', 'e')) with check (has_perm('news', 'e'));

revoke all on public.home_featured from anon, authenticated;
grant select on public.home_featured to anon, authenticated;
grant update (first_chapter, second_chapter) on public.home_featured to authenticated;
