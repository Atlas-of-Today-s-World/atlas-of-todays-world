# Testování

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

## 9. Testování

### 9.1 Testovací pyramida

| Vrstva | Nástroj | Co testuje | Kdy běží |
|---|---|---|---|
| Statická analýza | `tsc --noEmit`, ESLint (+ `eslint-plugin-security`, `@next/eslint-plugin-next`), Prettier | typy, nebezpečné vzory, formát | každý PR |
| Unit | **Vitest** | `lib/security/*`, Zod schémata, formátování, mapování chyb, cache tagy | každý PR |
| Databáze | **PGlite + node:test** (existující `npm run test:db`) | RLS, triggery, workflow, invarianty oprávnění, seed | každý PR |
| Integrace | Vitest + **lokální Supabase** (`supabase start` v CI) | Server Actions proti skutečnému Auth/PostgREST/Storage | každý PR (Docker v GitHub runneru) |
| E2E | **Playwright** (desktop + Pixel 7) + `@axe-core/playwright` | uživatelské toky, přístupnost | PR proti preview (dev DB) |
| Výkon | **Lighthouse CI** | rozpočty z 4.5 | PR (varování), main (blokuje) |
| Post-deploy | `npm run test:smoke` proti produkci | stránky 200, hlavičky, admin zamčený | po každém nasazení |

### 9.2 Pravidla

- Každá oprava chyby = nejdřív test, který ji reprodukuje.
- Každá nová tabulka/politika = DB test pro anon, pro roli s právem a pro roli bez práva.
- Každá Server Action = unit test validace + integrační test „bez práva → chyba, s právem → uloženo“.
- Testy nesmí záviset na produkčních datech; e2e používá seed dev projektu a testovací účty
  (`e2e-admin@…`, `e2e-publisher@…`), jejichž přihlášení obchází e-mail přes Auth Admin API v setupu testů.
- Pokrytí: `lib/security` a `features/*/schema.ts` 100 %, ostatní `lib` ≥ 80 %.

### 9.3 Matice autorizačních testů (povinná)

Pro každou sekci a roli tabulka očekávání `role × {read, create, update, delete, publish}`, generovaná jako
parametrický DB test z jednoho JSON souboru `supabase/tests/authz-matrix.json`. Změna oprávnění = změna matice
v témž PR.

### 9.4 Bezpečnostní testy

- XSS payloady (OWASP cheat sheet) přes všechna rich-text a URL pole → výstup bez spustitelného kódu.
- Přímé volání PostgREST s anon klíčem na všechny tabulky → žádný zápis, žádné neveřejné řádky.
- Pokus o eskalaci: změna vlastní role, přidání práv vlastní roli, publikace mimo `approve_entry`, zfalšované
  `set_config` příznaky.
- Open redirect, cizí Origin na mutacích, nadměrná velikost těla, rate limit.
