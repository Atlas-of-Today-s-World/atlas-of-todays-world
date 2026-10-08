# Analýza architektury — říjen 2026

> Stav kódu k 7. 10. 2026 (main po PR #104). Doplňuje standardy v ostatních souborech
> této složky: tady je, **jak to skutečně je**, kde se kód od standardů odchyluje a co
> s tím. Bezpečnostní nálezy a jejich opravy jsou v neveřejné zprávě (repo je veřejné).

## 1. Vrstvy a jejich odpovědnost

| Vrstva | Kde | Odpovídá za |
|---|---|---|
| Hrana | `src/proxy.ts` | bezpečnostní hlavičky a CSP, malá písmena v URL, `/` → `/en/…` (rewrite) a zpět, obnova relace jen na `/admin`, `/ucet`, `/login`, `/auth`, `/pozvanka`; brána `/admin`, `/api/admin`, `/ucet` |
| Trasy | `src/app/` | `[locale]/(map)` — layout drží glóbus (AtlasGlobe, MapControls, ContentRail), stránky posílají fokus mapy; `(pages)`, `(patrons)` — PagesShell; `admin/` — dynamické; `api/` — search, topics/search, geo, health, account/export; SEO trasy (sitemapy, feedy, `llms*.txt`, markdown, OG obrázky) |
| Doména | `src/features/<doména>/` | `queries.ts` veřejné čtení (`server-only`, anon klient + `unstable_cache` s tagy) · `editorial.ts` čtení administrace pod relací, bez cache · `actions.ts` zápisy (`"use server"`) · `schema.ts` Zod · `components/` |
| Sdílené UI | `src/components/` | `ui` primitiva, `atlas` vzory, `data-table`, `map`, `portrait`, `admin`, i18n |
| Infrastruktura | `src/lib/` | klienti Supabase, `cache/tags.ts`, security (CSP, sanitizace, URL, rate limit), SEO, formátování, `actions.ts` (`signedIn`, `failed`, `ActionState`), `db/filters.ts`, `tile-style.ts` |
| Konfigurace | `src/config/` | navigace, rozložení, menu administrace, údaje o organizaci |
| Databáze | `supabase/migrations/` | schéma, RLS, triggery a SECURITY DEFINER funkce (workflow, oprávnění, plánované zveřejnění) |

## 2. Datové toky

**Veřejné čtení:** RSC → `features/*/queries.ts` → `createPublicClient()` (anon, RLS) uvnitř
`unstable_cache(…, { tags, revalidate: 3600 })`. Tagy: `atlas`, `entries`, `entry:<slug>`,
`portrait:<kind>:<slug>`, `flags`, `redirects`, `patrons`. `getAtlas()` je per-request React
`cache` nad cachovaným snímkem a překryvem překladů; portrét je jedno RPC `portrait()`;
vyhledávání je RPC `search`.

**Zápis z administrace:** formulář → `ActionForm` / `useActionState` → server action → Zod →
`signedIn()` → přímý zápis `.from().update/insert` nebo `.rpc()` (workflow článků, šablony) →
chyba přes `failed()` / `mapDbError` → `updateTag(tags.x)` pro veřejná data + `revalidatePath`
pro administraci. O oprávnění rozhoduje databáze (RLS, triggery), akce kontroluje relaci a vstup.

**Glóbus:** `(map)/layout.tsx` spočítá na serveru barvy všech vrstev, hodnoty metrik po zemích,
počty topiců a geometrii oblastí a předá je jako props do `AtlasGlobe` (MapLibre 6, worker
z `public/maplibre`). Klidová rotace s pulzujícími čísly je výchozí stav domovské mapy.

**i18n:** `LOCALES = ["en"]`. Server: `localeFrom()` uloží jazyk do per-request stavu, `getT()`
ho čte; klient: `useMessages()`. Překladový kód (překryv z tabulky `translations`, jazykové
verze hesel v administraci) je odstraněný; tabulky a sloupce v DB zůstávají (ADR-022).

## 3. Porušení hranic modulů (ověřeno)

- **lib → features:** `lib/search.ts`, `lib/seo/*`, `lib/format.ts`, `lib/indicators.ts`,
  `lib/region-stats.ts` importují z `features/i18n` a `features/geography/types`. i18n je ve
  skutečnosti infrastruktura — patří do `lib/i18n`.
- **config → features:** `config/navigation.ts`, `organization.ts`, `admin-nav.ts`, `layout.ts`.
- **Vzájemné závislosti domén:** `entries ↔ portraits` (sdílené editory `CollectionEditor`,
  `RichTextEditor`, `UploadField`), `authors → entries/components/UploadField`. Řešení: sdílené
  editory do `components/admin/editor/`.
- **Stránky administrace dotazují Supabase přímo** mimo `editorial.ts`: invitations, areas,
  home, members, roles, volunteers.
- **Typy v `server-only` souborech** (`EntrySummary`, `SubtopicTile`) importují klientské
  komponenty jako `import type` — funguje, ale typy patří do souboru bez `server-only`.
- §4.1 nehlídá lint: `no-restricted-imports` blokuje jen `@supabase/supabase-js`.

## 4. Deset hlavních rizik a technického dluhu

1. **Tiché ořezání řádků.** `supabase/config.toml` má `max_rows = 1000`, ale kód žádá víc
   (`redirects/queries.ts` 5000, `entries/queries.ts` 5000, počty členů rolí, členové a
   dobrovolníci 2000). Řešení: stránkování helperem `all()` přesunutým do `lib/db`, nebo RPC
   s počty.
2. **`unstable_cache` je v Next 16 nahrazené** `"use cache"` + `cacheTag`; navíc přeskočí
   položky nad 2 MB — snímek atlasu (všechny hodnoty metrik + geometrie oblastí) je kandidát.
   Změřit a přejít.
3. **Doménová logika v `(map)/layout.tsx`** a payload s barvami všech vrstev na každé mapové
   stránce (proti §4.5: barvy jen aktivní vrstvy, líně).
4. **Hrubé cachování:** většina dotazů na články nese jen `tags.entries`, takže uložení
   libovolného článku zneplatní vše; portréty načítají všechny články a filtrují v paměti.
5. **Přerostlé moduly:** `entries/queries.ts`, `entries/actions.ts`, `AtlasGlobe.tsx`,
   `DataTable.tsx`, `lib/seo/jsonld.ts`. Doména `entries` míchá zprávy, topicy, dlaždice,
   kapitoly, šablony, náhledy a překlady.
6. **Hranice modulů bez vynucení** (oddíl 3) — `no-restricted-imports` pro směry
   `lib ↛ features`, `features ↛ features/*/components`.
7. **Křehký stav jazyka:** per-request mutable stav v `features/i18n/request.ts` funguje s
   jedním jazykem, s druhým by souběžně renderované layouty a stránky mohly dostat špatný text.
8. **Zápisy mimo RPC:** část přechodů stavu článku jde přímým `update` místo RPC (§4.3);
   dva typy `ActionState` a dvě strategie chybových hlášek.
9. **Rozdíl dokumentace a kódu:** strom §4.1 (`admin/entries|countries|…`) neodpovídá kódu
   (`content`, `areas`, `regions`, `global-issues`, `accounts`, `roles/audit`); §4.2–4.3 popisují
   `revalidateTag`, kód používá `updateTag` + `revalidatePath`; seznam D1–D8 v §15.3 je zastaralý.
10. **Produkt a hygiena:** `/membership/checkout` je ukázkový formulář karty (nic neodesílá,
    ale vypadá ostře); `demo/` drží ~1,7 MB generovaných souborů; 642 libovolných tříd
    `[var(--color-*)]` a 461 `text-[Npx]` místo tokenů a typografické škály.

## 5. Uklizeno v této vlně

- **Mrtvý kód:** `markdownToSafeHtml` a s ním závislost `marked`; nepoužité klíče zpráv
  (`header.language`, `header.switchTo`, `common.skipToContent`, `article.citeTitle/citeText`,
  `seo.sectionCountries`, `topics.filteredBy`); token `--color-patron-soft`; zastaralý komentář
  v `lib/content-types.ts`.
- **Duplicity:**
  - jeden vzor barvy `HEX_COLOR` a jedno pozadí dlaždice `tileBackground()` (`lib/tile-style.ts`)
    místo čtyř regexů a dvou implementací;
  - jeden filtr vyhledávání v administraci `ilikeAny()` (`lib/db/filters.ts`) místo čtyř kopií
    čištění vstupu pro PostgREST `.or()`;
  - název CSV souboru přes sdílené `slugify`;
  - odkazy na sociální sítě jednou komponentou (bar i menu).
- **Bezpečnost:** ochrany oprávnění v databázi, bezpečnější cookies, přesměrování a limity,
  zpřísněné CI (podrobnosti v neveřejné zprávě).

## 6. Další kroky (podle hodnoty)

1. Stránkování nad 1000 řádků (riziko 1) — data se dnes mohou tiše ztrácet.
2. `lib/i18n` a pravidla `no-restricted-imports` pro hranice vrstev (rizika 6, 7).
3. Jeden modul tras `config/routes.ts` místo ~90 ručně skládaných URL (`/country/${…}` …).
4. Sloučit stránky regionu a speciálního regionu (`loadGroupPortrait`, společné JSON-LD a
   metadata) a pět téměř shodných layoutů s kontrolou slugu (`guardSlug`).
5. `useDebouncedSearch` pro dvě kopie hledání s debounce a `formatDateTime` v `lib/format.ts`
   pro čtyři kopie formátu data a času.
6. Rozdělit doménu `entries` (news / topics / tiles / workflow) a `AtlasGlobe` (vrstvy,
   interakce, pulzy) na menší moduly.
7. Přejít z `unstable_cache` na `"use cache"` s jemnějšími tagy.
