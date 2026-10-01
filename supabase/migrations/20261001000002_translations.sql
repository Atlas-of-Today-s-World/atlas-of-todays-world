-- G5: překlady textů Atlasu do dalších jazyků (P15).
--
-- Angličtina zůstává v původních tabulkách (regions, countries, …) a je
-- výchozí; tady jsou jen překlady jednotlivých polí. Chybějící překlad =
-- web ukáže angličtinu. Kdo smí překládat, určuje sekce, do které celek patří
-- (stejně jako u úprav originálu): regiony a země → regions, global issues →
-- specials, ukazatele → layers.

create table public.translations (
  entity      text not null check (entity in ('region', 'country', 'issue', 'indicator')),
  entity_key  text not null check (length(entity_key) between 1 and 120),
  field       text not null check (field ~ '^[a-z_]{1,40}$'),
  locale      text not null check (locale ~ '^[a-z]{2}$' and locale <> 'en'),
  value       text not null check (length(value) <= 20000),
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (entity, entity_key, field, locale)
);
create index translations_locale on public.translations (locale, entity);
create index translations_updated_by on public.translations (updated_by);

create trigger translations_stamp before update on public.translations
  for each row execute function public.stamp_row();
create trigger translations_audit after insert or update or delete on public.translations
  for each row when (auth.uid() is not null) execute function public.audit_row('entity_key');

-- Sekce oprávnění, pod kterou celek patří.
create or replace function public.translation_section(p_entity text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case p_entity
    when 'region' then 'regions'
    when 'country' then 'regions'
    when 'issue' then 'specials'
    when 'indicator' then 'layers'
  end;
$$;

alter table public.translations enable row level security;

create policy translations_public on public.translations for select to anon, authenticated
  using (true);
create policy translations_insert on public.translations for insert to authenticated
  with check (has_perm(translation_section(entity), 'e'));
create policy translations_update on public.translations for update to authenticated
  using (has_perm(translation_section(entity), 'e'))
  with check (has_perm(translation_section(entity), 'e'));
create policy translations_delete on public.translations for delete to authenticated
  using (has_perm(translation_section(entity), 'e'));

revoke all on public.translations from public, anon, authenticated;
grant select (entity, entity_key, field, locale, value, updated_at) on public.translations
  to anon, authenticated;
grant insert (entity, entity_key, field, locale, value), update (value), delete
  on public.translations to authenticated;
revoke execute on function public.translation_section(text) from public, anon;
grant execute on function public.translation_section(text) to authenticated;
