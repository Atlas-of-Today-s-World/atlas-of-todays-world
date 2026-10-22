-- =============================================================================
-- Careers: open positions on /careers and applications with a CV
-- =============================================================================
--
-- 1. job_positions — what /careers lists. The team writes them in the admin
--    (Admin → Careers): title, location, type, a short summary for the list
--    and search results, and the full profile as formatted text (sanitized by
--    the app on save, lib/security/sanitize.ts, and again on render). Only
--    `open` positions are public; `draft` is being written, `closed` is kept
--    for the applications that came in. `opened_at` is set the first time a
--    position opens (the job posting's datePosted).
-- 2. job_applications — a visitor's application to one position: name,
--    e-mail, a message of a few paragraphs and a CV. Personal data: only the
--    `users` section reads, changes or deletes them, never anon. The title of
--    the position is copied in, so an application outlives its position.
-- 3. Bucket `job-applications` — the CVs, private (no public URL). Only the
--    server uploads (service role, after the form's checks); the team opens a
--    CV through a short-lived signed URL made under their own session, so the
--    storage policies below decide who may.
-- 4. submit_job_application() — the only way in: the position must be open,
--    and at most 30 applications an hour go in whatever the caller (the
--    server action rate-limits per IP first). Service role only.
-- 5. A "Careers" link in the footer menu (Admin → Site menus can move it).
--
-- Rights: positions — section `site` or `users` (either is enough); applications
-- and CVs — `users` only. Default privileges are revoked (20261013000210):
-- every grant is explicit.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Positions
-- ---------------------------------------------------------------------------
create table public.job_positions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (
    char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  location    text not null default '' check (char_length(location) <= 80),
  job_type    text not null default '' check (char_length(job_type) <= 60),
  summary     text not null default '' check (char_length(summary) <= 300),
  body_html   text not null default '' check (char_length(body_html) <= 30000),
  status      text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  opened_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index job_positions_open on public.job_positions (opened_at desc) where status = 'open';

create or replace function public.job_position_opened()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'open' and new.opened_at is null then
    new.opened_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.job_position_opened() from public, anon, authenticated;

create trigger job_positions_opened
  before insert or update on public.job_positions
  for each row execute function public.job_position_opened();

create trigger job_positions_stamp
  before update on public.job_positions
  for each row execute function public.stamp_row();

create trigger job_positions_audit
  after insert or update or delete on public.job_positions
  for each row execute function public.audit_row('id');

alter table public.job_positions enable row level security;

create policy job_positions_public on public.job_positions for select to anon
  using (status = 'open');
create policy job_positions_read on public.job_positions for select to authenticated
  using (
    status = 'open'
    or (select public.has_perm('site', 'v'))
    or (select public.has_perm('users', 'v'))
  );
create policy job_positions_add on public.job_positions for insert to authenticated
  with check ((select public.has_perm('site', 'c')) or (select public.has_perm('users', 'c')));
create policy job_positions_change on public.job_positions for update to authenticated
  using ((select public.has_perm('site', 'e')) or (select public.has_perm('users', 'e')))
  with check ((select public.has_perm('site', 'e')) or (select public.has_perm('users', 'e')));
create policy job_positions_remove on public.job_positions for delete to authenticated
  using ((select public.has_perm('site', 'd')) or (select public.has_perm('users', 'd')));

revoke all on public.job_positions from anon, authenticated;
grant select (id, slug, title, location, job_type, summary, body_html, status, opened_at,
              updated_at)
  on public.job_positions to anon;
grant select on public.job_positions to authenticated;
grant insert (slug, title, location, job_type, summary, body_html, status)
  on public.job_positions to authenticated;
grant update (slug, title, location, job_type, summary, body_html, status)
  on public.job_positions to authenticated;
grant delete on public.job_positions to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Applications
-- ---------------------------------------------------------------------------
create table public.job_applications (
  id              uuid primary key default gen_random_uuid(),
  position_id     uuid references public.job_positions (id) on delete set null,
  position_title  text not null check (char_length(position_title) between 1 and 120),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  email           text not null check (
    char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  message         text not null check (char_length(btrim(message)) between 1 and 8000),
  -- `<uuid>.<ext>` in the bucket job-applications.
  cv_path         text not null unique check (
    cv_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx|odt)$'
  ),
  cv_name         text not null check (char_length(cv_name) between 1 and 200),
  cv_size         integer not null check (cv_size between 1 and 4194304),
  status          text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index job_applications_created on public.job_applications (created_at desc);
create index job_applications_position on public.job_applications (position_id);

create trigger job_applications_stamp
  before update on public.job_applications
  for each row execute function public.stamp_row();

-- What a person wrote about themselves stays out of the audit log.
create trigger job_applications_audit
  after update or delete on public.job_applications
  for each row execute function public.audit_row('id', 'name', 'message', 'cv_name');

alter table public.job_applications enable row level security;

create policy job_applications_read on public.job_applications for select to authenticated
  using ((select public.has_perm('users', 'v')));
create policy job_applications_change on public.job_applications for update to authenticated
  using ((select public.has_perm('users', 'e'))) with check ((select public.has_perm('users', 'e')));
create policy job_applications_delete on public.job_applications for delete to authenticated
  using ((select public.has_perm('users', 'd')));

revoke all on public.job_applications from anon, authenticated;
grant select on public.job_applications to authenticated;
grant update (status) on public.job_applications to authenticated;
grant delete on public.job_applications to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The CVs (private bucket)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-applications', 'job-applications', false, 4194304,
        array['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.oasis.opendocument.text'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No insert or update policy: only the service role writes, and a file stays as uploaded.
create policy job_applications_cv_read on storage.objects for select to authenticated
  using (bucket_id = 'job-applications' and (select public.has_perm('users', 'v')));
create policy job_applications_cv_remove on storage.objects for delete to authenticated
  using (bucket_id = 'job-applications' and (select public.has_perm('users', 'd')));

-- ---------------------------------------------------------------------------
-- 4. Applying
-- ---------------------------------------------------------------------------
create or replace function public.submit_job_application(
  p_position_id uuid,
  p_name text,
  p_email text,
  p_message text,
  p_cv_path text,
  p_cv_name text,
  p_cv_size integer
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  open_title text;
begin
  select title into open_title from job_positions where id = p_position_id and status = 'open';
  if open_title is null then
    raise exception 'position_closed' using errcode = 'P0001';
  end if;
  if (
    select count(*) from job_applications where created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into job_applications (position_id, position_title, name, email, message, cv_path,
                                cv_name, cv_size)
  values (p_position_id, open_title, btrim(p_name), lower(btrim(p_email)), btrim(p_message),
          p_cv_path, p_cv_name, p_cv_size);
end;
$$;

revoke execute on function public.submit_job_application(uuid, text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.submit_job_application(uuid, text, text, text, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Footer link
-- ---------------------------------------------------------------------------
insert into public.nav_items (menu, label, href, position)
select 'legal', 'Careers', '/careers',
       coalesce((select max(position) + 1 from public.nav_items where menu = 'legal'), 0)
where not exists (select 1 from public.nav_items where href = '/careers');
