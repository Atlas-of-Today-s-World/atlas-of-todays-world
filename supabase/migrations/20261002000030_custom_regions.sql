-- =============================================================================
-- Vlastní regiony ze zemí (požadavek vlastníka 2026-10-01)
-- =============================================================================
--
-- Skupiny zemí napříč regiony Atlasu (`special_regions`) už existují jako
-- „Global Issues“ (válka, migrace, klima…). Vlastník chce stejným způsobem
-- skládat i vlastní regiony z vybraných zemí — se zeměmi, metrikami,
-- časovou osou i novinkami. Je to tatáž struktura, liší se jen tím, jak se
-- skupina jmenuje a ukazuje: `kind` = 'issue' (globální téma) nebo 'region'
-- (vlastní region). Stávající skupiny zůstávají globálními tématy.
--
-- Metriky skupiny dosud hlídalo právo na regiony Atlasu (`regions`), i když
-- skupinu samotnou spravuje sekce `specials`. Kdo smí upravovat skupinu, smí
-- teď i její karty metrik; regiony a země se řídí dál právem `regions`.
-- =============================================================================

alter table public.special_regions
  add column kind text not null default 'issue'
    constraint special_regions_kind check (kind in ('issue', 'region'));

comment on column public.special_regions.kind is
  'issue = globální téma (válka, migrace…), region = vlastní region složený z vybraných zemí';

-- ---------------------------------------------------------------------------
-- Karty metrik: skupina podle sekce specials, region a země podle regions
-- ---------------------------------------------------------------------------
-- Celou sekci ukládá replace_portrait_items (smaže a vloží v jedné transakci),
-- proto u skupiny stačí k mazání právo „e" — úprava sekce je jeden krok.

create or replace function public.can_edit_portrait_metric(p_special text)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select case when p_special is not null then has_perm('specials', 'e')
              else has_perm('regions', 'e') end
$$;

revoke execute on function public.can_edit_portrait_metric(text) from public, anon;
grant execute on function public.can_edit_portrait_metric(text) to authenticated;

drop policy portrait_metrics_add on public.portrait_metrics;
drop policy portrait_metrics_change on public.portrait_metrics;
drop policy portrait_metrics_remove on public.portrait_metrics;

create policy portrait_metrics_add on public.portrait_metrics for insert to authenticated
  with check (can_edit_portrait_metric(special_slug));
create policy portrait_metrics_change on public.portrait_metrics for update to authenticated
  using (can_edit_portrait_metric(special_slug))
  with check (can_edit_portrait_metric(special_slug));
create policy portrait_metrics_remove on public.portrait_metrics for delete to authenticated
  using (case when special_slug is not null then has_perm('specials', 'e')
              else has_perm('regions', 'd') end);
