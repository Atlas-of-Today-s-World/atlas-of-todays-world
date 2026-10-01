-- =============================================================================
-- Správa přesměrování (PLAN G3)
-- =============================================================================
--
-- Když se změní adresa (slug konceptu, stará URL z Webflow…), redakce přidá
-- přesměrování staré cesty na novou. Web ho uplatní jen tam, kde by jinak byla
-- stránka 404 — existující stránku přesměrování nepřebije, takže se jím nedá
-- „unést" živá adresa. Cíl je vždy cesta na vlastním webu (žádný open redirect).
--
-- Oprávnění drží sekce `news` (redakce, která adresy článků mění):
-- vidět `v`, přidat `c`, smazat `d`; admin vše. Úprava se neděje — přesměrování
-- se smaže a založí znovu. Veřejný web čte jen from/to/permanent.
-- =============================================================================

create table public.redirects (
  id          uuid primary key default gen_random_uuid(),
  from_path   text not null unique check (
                length(from_path) between 2 and 300
                and from_path ~ '^/[A-Za-z0-9._~%!$&''()*+,;=:@/-]+$'
                and from_path !~ '^//' and from_path !~ '/$'),
  to_path     text not null check (
                length(to_path) between 1 and 300
                and to_path ~ '^/[A-Za-z0-9._~%!$&''()*+,;=:@/?#-]*$'
                and to_path !~ '^//'),
  permanent   boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (from_path <> to_path)
);
create index redirects_created_by on public.redirects (created_by);

comment on table public.redirects is
  'Přesměrování staré cesty na novou; uplatní se jen místo stránky 404.';

-- Autor se zapíše sám a přesměrování nesmí vytvořit smyčku (a → b → … → a).
create or replace function public.guard_redirects()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  hop text := split_part(split_part(new.to_path, '#', 1), '?', 1);
  steps integer := 0;
begin
  new.created_by := auth.uid();
  new.created_at := now();
  while hop is not null and steps < 50 loop
    if hop = new.from_path then
      raise exception 'This redirect would loop back to where it starts.' using errcode = '22023';
    end if;
    select split_part(split_part(r.to_path, '#', 1), '?', 1) into hop
      from redirects r where r.from_path = hop;
    if not found then
      hop := null;
    end if;
    steps := steps + 1;
  end loop;
  return new;
end;
$$;
revoke execute on function public.guard_redirects() from public, anon, authenticated;

create trigger redirects_guard before insert on public.redirects
  for each row execute function public.guard_redirects();
create trigger redirects_audit after insert or delete on public.redirects
  for each row execute function public.audit_row('from_path');

alter table public.redirects enable row level security;

create policy redirects_public on public.redirects for select to anon
  using (true);
create policy redirects_read on public.redirects for select to authenticated
  using (true);
create policy redirects_add on public.redirects for insert to authenticated
  with check (has_perm('news', 'c'));
create policy redirects_remove on public.redirects for delete to authenticated
  using (has_perm('news', 'd'));

revoke all on public.redirects from anon, authenticated;
grant select (from_path, to_path, permanent) on public.redirects to anon;
grant select on public.redirects to authenticated;
grant insert (from_path, to_path, permanent) on public.redirects to authenticated;
grant delete on public.redirects to authenticated;
