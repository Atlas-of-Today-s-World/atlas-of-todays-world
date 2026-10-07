-- =============================================================================
-- Interaktivní grafy z Datawrapperu v karuselu portrétu
-- =============================================================================
--
-- Redakce vloží do administrace embed kód Datawrapperu (nebo odkaz na graf);
-- server z něj vytáhne jen URL grafu (src/lib/embeds.ts) a uloží ji jako
-- provider = 'datawrapper'. HTML ani skript se neukládá nikdy.
--
-- Jen přidává (expand): nový typ v CHECK, CHECK na tvar URL jen pro nový typ
-- (dosavadní řádky ho nemají) a klíč `provider` ve výstupu portrait() —
-- stará aplikace ho ignoruje.
-- =============================================================================

alter table public.visual_embeds drop constraint visual_embeds_provider_check;
alter table public.visual_embeds
  add constraint visual_embeds_provider_check
    check (provider in ('flourish', 'worldbank', 'image', 'datawrapper')),
  -- Stejný vzor jako datawrapperChartUrl(): přesný host, id grafu, verze, nic dalšího.
  add constraint visual_embeds_datawrapper_url
    check (provider <> 'datawrapper'
           or url ~ '^https://datawrapper\.dwcdn\.net/[A-Za-z0-9]{4,16}/[0-9]{1,4}/$');

-- portrait(): beze změny, jen vizuály nesou i svůj typ (obrázek vs. interaktivní graf).
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
      select jsonb_agg(jsonb_build_object('title', v.title, 'image', v.url, 'caption', v.caption,
                                          'provider', v.provider)
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
