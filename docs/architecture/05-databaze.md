# Databáze

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

## 6. Databáze

### 6.1 Model (přehled)

| Doména | Tabulky |
|---|---|
| Přístup | `roles`, `role_permissions`, `profiles`, `approver_countries`, `approver_authors`, `allowed_emails`, `security_settings`, `audit_log` |
| Geografie a data | `regions`, `countries`, `indicators`, `indicator_categories`, `indicator_values`, `indicator_styles`, `site_theme`, `special_regions`, `special_region_countries`, `map_areas` |
| Obsah | `authors`, `entries`, `entry_countries`, `entry_chapters`, `entry_revisions`, `timeline_events`, `faq_items`, `resources`, `portrait_metrics`, `visual_embeds` |
| Členství | `memberships`, `page_views_daily`, view `members_overview` |
| Storage | bucket `entry-images` (+ plánované `author-photos`, `illustrations`, `audio`) |
| Plánované | `invitations` (7.3), `translations` (P15), `rate_limits` (S9), `entries.search` tsvector (4.2) |

Workflow obsahu: `planned` → `draft` → `pending` → `published` (a zpět `published` → `draft` přes `unpublish_entry`).
Publikovat lze **jen** funkcí `approve_entry()`; trigger `guard_entries` blokuje jakýkoli jiný zápis `published`.

### 6.2 Konvence schématu (standard)

- Tabulky v množném čísle, `snake_case`; PK `uuid default gen_random_uuid()` nebo přirozený klíč (`slug`, `iso3`).
- Výčty jako `text` + `CHECK (x in (…))` — snadno se rozšiřují migrací.
- Každý textový sloupec má `CHECK (length(...) <= N)`. Každý URL sloupec má `CHECK (x ~ '^https://')`.
- `created_at`, `updated_at timestamptz not null default now()` + trigger `stamp_row`.
- **Každý cizí klíč má index** (i kvůli RLS a kaskádám).
- **RLS zapnuté na každé tabulce** hned v migraci, která ji vytváří. Tabulka bez politik = nikdo nic.
- Politiky odděleně pro `select` / `insert` / `update` / `delete` — **ne `for all`**, aby `delete` vyžadoval
  právo `d` a ne jen `e`.
- Granty explicitně (`auto_expose_new_tables` je vypnuté): `anon` jen `select` na veřejné tabulky.
- Funkce: vždy `set search_path = public, pg_temp`; `SECURITY DEFINER` jen když musí číst tabulky mimo práva
  volajícího; `revoke execute … from public, anon` a `grant` jen `authenticated`, kde to dává smysl.
- **Guard triggery, které čtou tabulky chráněné RLS, musí být `SECURITY DEFINER`** (jinak pod RLS volajícího
  dostanou prázdný výsledek a kontrola se tiše přeskočí).
- Citlivé sloupce, které nesmí vidět anon (`owner_id`, `review_note`, `approved_by`, `profile_id`), se
  veřejnosti vystavují přes **view `public_*`** nebo column-level granty, ne přes celou tabulku.
- Audit: změny oprávnění, rolí, účtů, stavů obsahu a mazání se logují triggery do `audit_log`
  (nelze mazat ani zapisovat z klienta). Nelogovat plné osobní údaje — jen změněná pole bez e-mailu/telefonu.

### 6.3 Migrace

- Nástroj: **Supabase CLI**. Nová migrace: `supabase migration new <popis>` → `supabase/migrations/<timestamp>_<popis>.sql`.
- **Aplikovanou migraci nikdy neupravovat.** Oprava = nová migrace.
- Migrace musí být **zpětně kompatibilní s běžící verzí aplikace** (expand → migrate → contract):
  1. přidat sloupec/tabulku (nullable nebo s defaultem),
  2. nasadit kód, který používá obojí,
  3. v další migraci odstranit staré.
- Destruktivní změny (drop, rename, změna typu) jen s poznámkou v PR a zálohou (`pg_dump`) před nasazením.
- Migrace aplikuje **CI** před nasazením aplikace (`supabase db push`), nikdy ručně z notebooku do produkce.
- Po každé migraci: `supabase gen types typescript --linked > src/lib/db/types.gen.ts` a commit.

### 6.4 Seed a data

- `supabase/seed.sql` se generuje skriptem `scripts/db/build-seed.mjs`; je idempotentní (`on conflict`) a
  nepřepisuje ruční úpravy (`is_manual`).
- Import ukazatelů (OWID) jde přes **upsert** se servisním klíčem ze skriptu, ne přes aplikaci.
- Testovací účty a fixtures jen v dev projektu / lokálně, nikdy v produkčním seedu.

### 6.5 Zálohy a obnova

- Free tarif nemá denní zálohy → **noční GitHub Action** `pg_dump` produkční DB, dump **zašifrovaný** (age/GPG,
  veřejný klíč v repu, privátní jen u správce) a uložený mimo veřejné artefakty (repo je veřejné — artefakty
  Actions jsou stažitelné). Retence 14 dní.
- Obnova dev databáze: `npm run db:reset` (jen dev projekt) = migrace + seed.
- Před spuštěním do provozu přejít na Supabase Pro (denní zálohy, žádné uspávání) — viz ADR-008.
