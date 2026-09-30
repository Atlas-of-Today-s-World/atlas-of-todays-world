-- =============================================================================
-- Pořadí ukazatelů (přepínač vrstev, karta země, legenda)
-- =============================================================================
-- Dosud ho určovalo pořadí klíčů v src/data/indicators.generated.json; v DB
-- ho nese sloupec. Existujícím ukazatelům se nastaví dosavadní pořadí.

alter table public.indicators add column position integer not null default 100;

update public.indicators i set position = o.position
from (values ('hdi', 0), ('life-expectancy', 1), ('gdp-per-capita', 2), ('political-regime', 3),
             ('democracy-index', 4), ('corruption', 5), ('extreme-poverty', 6),
             ('co2-per-capita', 7), ('internet-users', 8)) as o(id, position)
where i.id = o.id;
