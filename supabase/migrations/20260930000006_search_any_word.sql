-- =============================================================================
-- Vyhledávání: stačí kterékoli slovo, pořadí určí relevance
-- =============================================================================
-- Dotaz „political situation in Russia" musí najít Rusko, i když ostatní slova
-- nikde nejsou. Krátká slova (in, of, a) se ignorují.

create or replace function public.search_query(p_text text)
returns tsquery
language sql immutable
set search_path = public, pg_temp
as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(quote_literal(word) || ':*', ' | ')) end
  from (
    select distinct lower(word) as word
    from regexp_split_to_table(left(coalesce(p_text, ''), 200), '[^[:alnum:]]+') as word
    where length(word) >= 3
    limit 8
  ) words;
$$;
