-- =============================================================================
-- UI text overrides: the team changes the public site's texts in the admin
-- (section `site`, Admin → UI texts)
-- =============================================================================
--
-- The site's interface texts (buttons, headings, labels, page metadata, feed
-- and preview-image texts) live in src/messages/en.json. This table holds only
-- the texts the team has changed: one row per changed text, keyed by its dot
-- path in en.json ("home.title", "patrons.benefits.0.title"). No row = the
-- built-in text. Resetting a text to its default deletes the row.
--
-- The app validates every save against the en.json it ships (the key must be
-- an editable text, the {placeholders} must be exactly those of the default,
-- plain text only) and checks the rows again when it reads them, so a row that
-- no longer fits (a key renamed in the code) is ignored, never shown. The
-- database can't know en.json; its CHECKs guard the shape: the key format, the
-- length, no "<" (plain text, never markup).
--
-- Everyone reads the key and the text (every public page shows them); who
-- changed it stays internal. `site` c/e/d insert, change and delete; every
-- change is in the audit log (audit_row, keyed by the text's key).
--
-- Grants are explicit (revoke all, then exactly what the policies intend), so
-- the migration does not rely on default privileges for new tables.
-- =============================================================================

create table public.ui_text_overrides (
  -- Dot path in en.json: a namespace, then segments of letters, digits, "_",
  -- and (category names) spaces and "&".
  key        text primary key check (
    char_length(key) <= 200
    and key ~ '^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_&][A-Za-z0-9_& ]*)+$'
  ),
  -- Plain text: not blank, at most 2000 characters, no "<" (no markup).
  value      text not null check (
    char_length(value) <= 2000
    and btrim(value) <> ''
    and strpos(value, '<') = 0
  ),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index ui_text_overrides_updated_by on public.ui_text_overrides (updated_by);

comment on table public.ui_text_overrides is
  'Texts of src/messages/en.json the team changed in the admin (key = dot path); no row = the built-in text.';

-- Who changed it: the signed-in editor (null for migrations and the service key).
create or replace function public.stamp_ui_text_editor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.stamp_ui_text_editor() from public, anon, authenticated;

create trigger ui_text_overrides_stamp
  before update on public.ui_text_overrides
  for each row execute function public.stamp_row();
create trigger ui_text_overrides_stamp_editor
  before insert or update on public.ui_text_overrides
  for each row execute function public.stamp_ui_text_editor();
create trigger ui_text_overrides_audit
  after insert or update or delete on public.ui_text_overrides
  for each row execute function public.audit_row('key');

alter table public.ui_text_overrides enable row level security;

create policy ui_text_overrides_read_public on public.ui_text_overrides
  for select to anon
  using (true);
create policy ui_text_overrides_read_team on public.ui_text_overrides
  for select to authenticated
  using (true);
create policy ui_text_overrides_insert on public.ui_text_overrides
  for insert to authenticated
  with check ((select public.has_perm('site', 'c')));
create policy ui_text_overrides_update on public.ui_text_overrides
  for update to authenticated
  using ((select public.has_perm('site', 'e')))
  with check ((select public.has_perm('site', 'e')));
create policy ui_text_overrides_delete on public.ui_text_overrides
  for delete to authenticated
  using ((select public.has_perm('site', 'd')));

revoke all on public.ui_text_overrides from anon, authenticated;
grant select (key, value) on public.ui_text_overrides to anon;
grant select on public.ui_text_overrides to authenticated;
grant insert (key, value) on public.ui_text_overrides to authenticated;
grant update (value) on public.ui_text_overrides to authenticated;
grant delete on public.ui_text_overrides to authenticated;
