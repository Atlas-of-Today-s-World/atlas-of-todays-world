-- =============================================================================
-- Veřejný web čte z databáze (PLAN D1, D3)
-- =============================================================================
--
-- Jen přidává (expand): nové sloupce mají výchozí hodnoty, stará aplikace je
-- nevidí a nic nerozbijí.
--
--   * fotka v hlavičce portrétu regionu i global issue
--   * redakční profil země (text, podtitulek, vybrané ukazatele) — dosud
--     v src/content/countries/*.md
--   * portrait(kind, slug): celý portrét jedním dotazem (ARCHITEKTURA 4.2)
-- =============================================================================

alter table public.regions
  add column hero_url text check (hero_url is null or hero_url ~ '^https://'),
  add column hero_credit text not null default '' check (length(hero_credit) <= 300);

alter table public.special_regions
  add column hero_url text check (hero_url is null or hero_url ~ '^https://'),
  add column hero_credit text not null default '' check (length(hero_credit) <= 300);

alter table public.countries
  add column tagline text not null default '' check (length(tagline) <= 300),
  -- HTML z editoru, vyčištěné na serveru při uložení i při vykreslení.
  add column profile_html text not null default '' check (length(profile_html) <= 200000),
  -- Které importované ukazatele ukázat na kartě a v jakém pořadí; prázdné = prvních šest.
  add column featured_indicators text[] not null default '{}'
    check (coalesce(array_length(featured_indicators, 1), 0) <= 12);

-- Rok u ruční karty je často období („mid-2025"), ne číslo.
alter table public.portrait_metrics
  add column period text check (length(period) <= 20);

-- ---------------------------------------------------------------------------
-- portrait(kind, slug) — obsah portrétu regionu nebo global issue v jednom JSON
-- ---------------------------------------------------------------------------
-- security invoker: čte se pod RLS volajícího (anon vidí jen veřejné tabulky).
-- Neexistující portrét vrací null.

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
      select jsonb_agg(jsonb_build_object('date', t.date_label, 'title', t.title, 'text', t.body)
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
      select jsonb_agg(jsonb_build_object('title', v.title, 'image', v.url, 'caption', v.caption)
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
