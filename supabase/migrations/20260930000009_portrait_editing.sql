-- =============================================================================
-- Úprava portrétů z administrace (PLAN E4)
-- =============================================================================
--
-- replace_portrait_items(kind, slug, collection, items): nahradí celou
-- kolekci portrétu (časová osa, FAQ, zdroje, vizuály, ruční karty) jedním
-- voláním — smazání i vložení v jedné transakci, takže chyba uprostřed
-- nenechá portrét poloprázdný.
--
-- security invoker: běží pod RLS volajícího. Kdo nemá právo na tabulku,
-- nesmaže nic a vložení selže → celé volání se vrátí.
-- =============================================================================

create or replace function public.replace_portrait_items(
  p_kind text, p_slug text, p_collection text, p_items jsonb)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_region  text := case when p_kind = 'region' then p_slug end;
  v_special text := case when p_kind = 'issue' then p_slug end;
  v_country text := case when p_kind = 'country' then p_slug end;
begin
  if p_kind not in ('region', 'issue', 'country') or (p_kind = 'country' and p_collection <> 'metrics') then
    raise exception 'Unknown portrait.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'A portrait section holds at most 50 items.' using errcode = '22023';
  end if;

  case p_collection
  when 'timeline' then
    delete from timeline_events
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into timeline_events (region_slug, special_slug, position, date_label, title, body, image_url)
    select v_region, v_special, (ord - 1)::int, i ->> 'date_label', i ->> 'title',
           coalesce(i ->> 'body', ''), nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'faq' then
    delete from faq_items
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into faq_items (region_slug, special_slug, position, question, answer)
    select v_region, v_special, (ord - 1)::int, i ->> 'question', i ->> 'answer'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'resources' then
    delete from resources
     where entry_id is null
       and region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into resources (region_slug, special_slug, position, kind, title, source, description, url, image_url)
    select v_region, v_special, (ord - 1)::int, i ->> 'kind', i ->> 'title', coalesce(i ->> 'source', ''),
           coalesce(i ->> 'description', ''), i ->> 'url', nullif(i ->> 'image_url', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'visuals' then
    delete from visual_embeds
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special;
    insert into visual_embeds (region_slug, special_slug, position, provider, title, caption, url)
    select v_region, v_special, (ord - 1)::int, i ->> 'provider', i ->> 'title',
           coalesce(i ->> 'caption', ''), i ->> 'url'
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  when 'metrics' then
    delete from portrait_metrics
     where region_slug is not distinct from v_region and special_slug is not distinct from v_special
       and country_iso3 is not distinct from v_country;
    insert into portrait_metrics (region_slug, special_slug, country_iso3, position, value, label,
                                  description, source, source_url, period)
    select v_region, v_special, v_country, (ord - 1)::int, i ->> 'value', i ->> 'label',
           coalesce(i ->> 'description', ''), i ->> 'source', nullif(i ->> 'source_url', ''),
           nullif(i ->> 'period', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);

  else
    raise exception 'Unknown portrait section.' using errcode = '22023';
  end case;
end;
$$;

revoke execute on function public.replace_portrait_items(text, text, text, jsonb) from public, anon;
grant execute on function public.replace_portrait_items(text, text, text, jsonb) to authenticated;
