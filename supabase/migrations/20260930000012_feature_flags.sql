-- =============================================================================
-- Přepínače funkcí a režim údržby (PLAN F6)
-- =============================================================================
--
-- Malá tabulka zapnuto/vypnuto, kterou aplikace čte (veřejně, s cache) a
-- administrace přepíná. Bez nového nasazení tak jde vypnout web do údržby
-- nebo schovat funkci, která zlobí.
-- =============================================================================

create table public.feature_flags (
  key         text primary key check (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(key) <= 40),
  enabled     boolean not null default false,
  note        text not null default '' check (length(note) <= 300),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index feature_flags_updated_by on public.feature_flags (updated_by);

insert into public.feature_flags (key, enabled, note) values
  ('maintenance', false, 'Veřejný web ukáže oznámení o údržbě; administrace a přihlášení běží dál.'),
  ('newsletter', true, 'Formulář pro odběr novinek v menu.');

create or replace function public.stamp_feature_flag()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.stamp_feature_flag() from public, anon, authenticated;

create trigger feature_flags_stamp before update on public.feature_flags
  for each row execute function public.stamp_feature_flag();
create trigger feature_flags_audit after update on public.feature_flags
  for each row execute function public.audit_row('key');

alter table public.feature_flags enable row level security;

-- Veřejný web přepínače čte; přidávají se migrací (s kódem, který je používá).
create policy feature_flags_public on public.feature_flags for select to anon, authenticated
  using (true);
create policy feature_flags_change on public.feature_flags for update to authenticated
  using (has_perm('permissions', 'e')) with check (has_perm('permissions', 'e'));

revoke all on public.feature_flags from anon, authenticated;
grant select (key, enabled, note, updated_at) on public.feature_flags to anon;
grant select on public.feature_flags to authenticated;
grant update (enabled, note) on public.feature_flags to authenticated;
