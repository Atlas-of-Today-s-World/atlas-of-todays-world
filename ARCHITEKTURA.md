# Atlas of Today's World — architektura a postupové standardy

> **Stav:** návrh k realizaci · **Verze:** 1.0 · **Datum:** 2026-09-30
> **Platí pro:** všechen kód v tomto repozitáři (aplikace `src/`, databáze `supabase/`, skripty, CI).
> **Závaznost:** kapitoly 3–10 jsou *standardy* — odchylka jen s poznámkou v PR a zápisem do [ADR](#11-rozhodnutí-adr).
> Konkrétní nálezy ze security review současného stavu jsou v neveřejném `docs/architektura-nalezy.md`
> (repo je veřejné); tady se na ně odkazuje jen identifikátorem (`SEC-xx`, `DB-xx`).

---

## Obsah

1. [Cíl a výchozí stav](#1-cíl-a-výchozí-stav)
2. [Architektonické principy](#2-architektonické-principy)
3. [Infrastruktura a prostředí](#3-infrastruktura-a-prostředí)
4. [Aplikační architektura](#4-aplikační-architektura)
5. [Komponenty a UI](#5-komponenty-a-ui)
6. [Databáze](#6-databáze)
7. [Autentizace, role a oprávnění](#7-autentizace-role-a-oprávnění)
8. [Bezpečnostní standardy](#8-bezpečnostní-standardy)
9. [Testování](#9-testování)
10. [CI/CD a provoz](#10-cicd-a-provoz)
11. [Rozhodnutí (ADR)](#11-rozhodnutí-adr)
12. [Plán realizace](#12-plán-realizace)
13. [Postupové standardy (checklisty)](#13-postupové-standardy-checklisty)
14. [Otevřené otázky](#14-otevřené-otázky)
15. [Jednotnost komponent a deduplikace](#15-jednotnost-komponent-a-deduplikace)
16. [Další standardy správné webové aplikace](#16-další-standardy-správné-webové-aplikace)

---

## 1. Cíl a výchozí stav

### 1.1 Cíl

Z dnešní aplikace, která čte obsah ze souborů v gitu, udělat **plnohodnotnou webovou aplikaci nad Supabase**:

- veřejný web (globus, regiony, země, global issues, hesla, datové vrstvy) čte z databáze,
- přihlášení uživatelé **ukládají** obsah přímo do databáze přes administraci,
- oprávnění, schvalování a audit vynucuje **databáze** (RLS + funkce), aplikace je jen zobrazuje,
- **čtenáři** se registrují sami (Google, později vlastní e-mail) a dostanou roli `reader`,
- **interní tým** (admini, redaktoři, schvalovatelé…) vstupuje **jen na pozvánku** od admina, která rovnou
  určuje roli a práva (viz [7.3 Registrace a pozvánky](#73-registrace-čtenářů-a-pozvánky-týmu)).

### 1.2 Výchozí stav (2026-09-30)

| Oblast | Stav |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TS `strict`, Tailwind 4, MapLibre GL 5 (globus). Globus je v layoutu `(map)` a mezi stránkami se nepřemontovává. |
| Obsah | Soubory: `src/content/**` (Markdown/JSON), generovaná data `src/data/*.generated.json`, geometrie `public/data/*.geo.json`. |
| Administrace | `/admin` se 4 záložkami (Novinky, Země, Regiony, Global Issues), ukládá **zápisem do souborů** — na Vercelu nefunkční (read-only FS). Přístup přes sdílené heslo `ADMIN_TOKEN`, bez něj v produkci 404. |
| Databáze | Supabase (Frankfurt), 5 migrací, 30 tabulek, RLS na všech, role × sekce × akce, schvalovací workflow, audit, revize, seed s reálnými daty. Aplikace ji **zatím nepoužívá**. Testy RLS v PGlite (`npm run test:db`). |
| Testy | Playwright (16 toků), fetch smoke test, DB testy v PGlite. Žádné unit testy aplikace, žádný lint. |
| CI/CD | GitHub Actions → Vercel (Hobby) přes token. CI zatím **nespouští testy**. |
| Hosting | Vercel Hobby, veřejný GitHub repozitář, Supabase Free. |

### 1.3 Mimo rozsah tohoto dokumentu

Webflow migrace (P16), platby Stripe (P10), jazykové mutace (P15) a audio (R4) mají v architektuře
připravené místo (kapitoly 4, 6), ale jejich realizace je samostatná etapa.

---

## 2. Architektonické principy

1. **Databáze rozhoduje, aplikace zobrazuje.** Každé pravidlo „kdo smí co“ je v RLS nebo v `SECURITY DEFINER`
   funkci. Kontrola v aplikaci je jen UX (skrytí tlačítka), nikdy jediná ochrana.
2. **Server first.** Server Components jsou výchozí. Klientská komponenta jen tam, kde je interaktivita
   (globus, formuláře, editor). Tajné klíče a privilegovaný přístup nikdy v prohlížeči.
3. **Jeden zdroj pravdy.** Po migraci obsahu do DB se `src/content/**` maže. Žádná data nejsou ve dvou místech.
   Výjimka: geometrie a generovaná data z importů zůstávají v gitu (jsou to build artefakty, ne redakční obsah).
4. **Least privilege.** Každý kód používá nejslabší klíč, který stačí: veřejné čtení = `anon`, akce uživatele
   = jeho session (RLS), servisní klíč jen webhooky a importy.
5. **Validace na každé hranici.** Vše, co přijde zvenku (formulář, URL, JSON, webhook, env), projde schématem (Zod).
6. **Nudné technologie.** Preferujeme oficiální knihovny a vzory ekosystému (`@supabase/ssr`, shadcn/ui, Zod,
   TanStack Table, TipTap). Nová závislost = jedna věta zdůvodnění v PR.
7. **Předání projektu.** Běžný webový vývojář musí projekt převzít podle tohoto dokumentu a README.
   Žádná „magie“, žádné ruční kroky při nasazení.
8. **Bezpečně ve výchozím stavu.** Nový endpoint, tabulka nebo bucket je zavřený, dokud ho explicitně neotevřeme.

---

## 3. Infrastruktura a prostředí

### 3.1 Přehled

```
 Prohlížeč ──HTTPS──▶ Vercel (Next.js)
   │                    ├─ statické/ISR stránky (CDN)       ── anon klíč ──▶ Supabase PostgREST (RLS)
   │                    ├─ Server Actions / Route Handlers  ── session uživatele ─▶ Supabase (RLS)
   │                    └─ webhooky (Stripe, později)       ── service key ──▶ Supabase
   │
   └── MapLibre ──▶ dlaždice Esri/MapTiler, fonts.openmaptiles.org, /data/*.geo.json (CDN)

 GitHub (veřejné repo) ── Actions ──▶ testy ─▶ migrace (supabase db push) ─▶ vercel deploy
 Supabase: Postgres 17 + Auth + Storage (Frankfurt, eu-central-1)
```

### 3.2 Služby a jejich limity

| Služba | Tarif | Limity, které ovlivňují architekturu |
|---|---|---|
| **Vercel** | Hobby | Jen nekomerční použití (koncept OK, před spuštěním s platbami → Pro). Nasazuje se přes token z GitHub Actions; u **soukromého** repa by Vercel nasazení od jiných autorů blokoval → repo je veřejné. Funkce max 300 s. Read-only filesystém (zapisovat jen do `/tmp`). |
| **Supabase** | Free | Projekt se uspí po 7 dnech bez provozu. Bez denních záloh a PITR. Vestavěný e-mail posílá **jen členům týmu** a pár zpráv za hodinu → pro veřejné přihlášení je nutné **vlastní SMTP** (viz 7.1). 500 MB DB, 1 GB Storage. |
| **GitHub** | Free, veřejné repo | Neomezené minuty Actions, zdarma CodeQL, secret scanning a push protection, Dependabot. |

### 3.3 Prostředí

| Prostředí | Aplikace | Databáze | Kdy |
|---|---|---|---|
| **local** | `npm run dev` | `supabase start` (Docker) **nebo** PGlite pro DB testy | vývoj |
| **preview** | Vercel preview z PR | **dev** Supabase projekt (druhý Free projekt) | každý PR |
| **production** | `atlas-of-todays-world.vercel.app` | produkční Supabase projekt | push do `main` |

- Free tarif dovoluje dva aktivní projekty → **doporučeno založit druhý projekt `atlas-dev`** pro preview a e2e testy,
  aby testy nikdy nesahaly na produkční data (ADR-007).
- Dokud dev projekt neexistuje, preview deploye používají produkční DB **jen pro čtení** (e2e zápisové testy se nespouštějí).

### 3.4 Konfigurace a tajné údaje

Všechny proměnné prostředí se validují při startu v `src/lib/env.ts` (Zod). Chybějící povinná proměnná = pád buildu,
ne tiché selhání za běhu.

| Proměnná | Kde | Veřejná? | Účel |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel | ano | kanonické URL, sitemap, redirect URL pro auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | ano | adresa projektu |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | ano | publishable klíč; bez přihlášení čte jen veřejná data (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (sensitive) | **ne** | obchází RLS — jen webhooky a importy, soubor s `import "server-only"` |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | GitHub Secrets | **ne** | CI: `supabase db push` |
| `SUPABASE_PROJECT_REF` | GitHub Variables | ano | CI: cílový projekt |
| `VERCEL_TOKEN` | GitHub Secrets | **ne** | CI: nasazení |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub Variables | ano | CI: nasazení |
| `MAILCHIMP_*`, `STRIPE_*`, `NEXT_PUBLIC_MAPTILER_KEY` | Vercel | dle názvu | volitelné služby |

Pravidla:

- Proměnná s prefixem `NEXT_PUBLIC_` je **veřejná** (skončí v JS bundlu). Tajný údaj nikdy s tímto prefixem.
- Žádné hodnoty v gitu. `.env.example` obsahuje jen názvy a popis. Lokální `.env.local` / `.env.deploy.local` jsou v `.gitignore`.
- Podezření na únik klíče = okamžitá rotace (Supabase → API keys, Vercel → Tokens) a záznam do incident logu.
- `ADMIN_TOKEN` se ruší spolu s přechodem na Supabase Auth.

---

## 4. Aplikační architektura

### 4.1 Cílová struktura adresářů

```
src/
├─ app/                          # jen routing, layouty a tenké stránky — žádná doménová logika
│  ├─ (map)/                     # veřejné stránky s globusem (layout drží <AtlasGlobe>)
│  ├─ (pages)/                   # veřejné stránky bez globusu (about, patrons, search…)
│  ├─ admin/                     # administrace — vlastní layout (shell + menu z my_permissions())
│  │  ├─ layout.tsx              # ověří session, načte oprávnění, noindex, force-dynamic
│  │  ├─ entries/…  countries/…  regions/…  issues/…  indicators/…  users/…  roles/…  audit/…
│  ├─ auth/
│  │  ├─ callback/route.ts       # PKCE výměna kódu za session
│  │  └─ confirm/route.ts        # ověření OTP / magic link (token_hash)
│  ├─ login/page.tsx
│  └─ api/                       # jen to, co nemůže být Server Action: webhooky, veřejné API (search)
├─ features/                     # doménové moduly — jeden adresář = jedna doména
│  └─ <doména>/                  # entries, portraits, geography, indicators, issues, users, roles, audit…
│     ├─ schema.ts               # Zod schémata vstupů (sdílená klient/server)
│     ├─ queries.ts              # čtení (server-only), cache tagy
│     ├─ actions.ts              # Server Actions ("use server"), mutace
│     ├─ components/             # UI specifické pro doménu
│     └─ *.test.ts               # unit testy domény
├─ components/
│  ├─ ui/                        # shadcn/ui primitiva (Button, Dialog, Form, Table…)
│  ├─ map/                       # globus a jeho ovládání (dnešní stav, zachovat)
│  └─ portrait/                  # sdílené sekce portrétu (region i global issue)
├─ lib/
│  ├─ env.ts                     # validované env proměnné
│  ├─ supabase/
│  │  ├─ server.ts               # klient se session uživatele (cookies) — RLS jako uživatel
│  │  ├─ public.ts               # anon klient bez cookies — pro ISR/statické čtení
│  │  ├─ service.ts              # service-role klient — "server-only", jen webhooky/importy
│  │  ├─ browser.ts              # klient v prohlížeči — jen auth UI a upload obrázků
│  │  └─ middleware.ts           # obnova session v middleware
│  ├─ db/types.gen.ts            # `supabase gen types` — negenerovat ručně
│  ├─ security/                  # sanitize.ts, urls.ts, redirect.ts, rate-limit.ts, csp.ts
│  ├─ cache/tags.ts              # jediný zdroj názvů cache tagů
│  └─ …                          # čisté utility (formatValue, seo…)
└─ proxy.ts                      # (dříve middleware) hlavičky, CSP, obnova session, ochrana /admin
```

Pravidla vrstev:

- `app/` smí importovat `features/`, `components/`, `lib/`. Opačně nikdy.
- `features/X` nesmí importovat z `features/Y` interní soubory — jen jejich `queries.ts`/`schema.ts`.
- Soubory, které smí běžet jen na serveru (`queries.ts`, `actions.ts`, `lib/supabase/server|service|public.ts`),
  začínají `import "server-only"`.

### 4.2 Čtení dat (veřejný web)

- Veřejné stránky jsou **statické s ISR**. Čtou přes `lib/supabase/public.ts` (anon klíč, bez cookies → cacheovatelné).
  RLS zaručí, že uvidí jen publikovaný obsah.
- Každý dotaz je obalený `unstable_cache(fn, key, { tags })` s tagy z `lib/cache/tags.ts`
  (`entry:<slug>`, `entries`, `region:<slug>`, `country:<iso3>`, `issue:<slug>`, `indicators`, `theme`).
- Po mutaci Server Action zavolá `revalidateTag()` pro dotčené tagy — **nikdy** `revalidatePath` naslepo
  a nikdy `force-dynamic` na veřejném obsahu.
- Portrét regionu/issue se načítá **jedním dotazem** (DB funkce `portrait(slug)` vracející JSON), ne N dotazy.
- `generateStaticParams` generuje známé slugy; `dynamicParams = true` pro obsah, který vzniká v administraci.
- Fulltext: MiniSearch v paměti procesu se nahradí **Postgres full-text** (`tsvector` sloupec + GIN index,
  `unaccent`, RPC `search(q, limit)`) — index je vždy aktuální a sdílený všemi instancemi (ADR-005).

### 4.3 Zápis dat (administrace)

Všechny mutace jdou přes **Server Actions** ve `features/<doména>/actions.ts`. Vzor:

```ts
"use server";
import "server-only";

export async function saveEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = EntryInput.safeParse(Object.fromEntries(formData));     // 1) validace
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createServerClient();                           // 2) klient se session
  const { data: { user } } = await supabase.auth.getUser();              //    getUser(), NE getSession()
  if (!user) return { ok: false, error: "unauthenticated" };

  const clean = { ...parsed.data, body_html: sanitizeRichText(parsed.data.body_html) }; // 3) sanitizace
  const { data, error } = await supabase.from("entries").upsert(clean).select("slug").single(); // 4) RLS rozhodne
  if (error) return mapDbError(error);                                   // 5) bez úniku detailů

  revalidateTag(tags.entry(data.slug)); revalidateTag(tags.entries);     // 6) invalidace cache
  return { ok: true };
}
```

- Workflow přechody (odeslat ke schválení, schválit, vrátit, stáhnout) volají **RPC funkce** (`submit_entry`,
  `approve_entry`, …), nikdy přímý `update status`.
- Chyby z DB se mapují v `mapDbError` na uživatelské hlášky (RLS 42501 → „Nemáte oprávnění“, CHECK 23514 → hláška
  k poli). Surová chyba jde jen do serverového logu.
- Route Handlers (`app/api/**`) jen pro: webhooky (podpis!), veřejné API (search), exporty. Každý handler si
  autorizaci ověří **sám** — nespoléhá jen na middleware.

### 4.4 Obrázky a soubory

- Upload z administrace jde **přímo z prohlížeče do Supabase Storage** (browser klient se session → Storage RLS),
  cesta `{bucket}/{user_id}/{uuid}.{ext}`. Server ukládá do DB jen cestu.
- Buckety: `entry-images` (existuje), doplnit `author-photos`, `illustrations`, později `audio`.
  Povolené typy JPEG/PNG/WebP/AVIF, **bez SVG**, limit 3 MB (audio samostatně).
- `next/image` jen s explicitním `remotePatterns` na Supabase Storage a konkrétní hosty — nikdy `hostname: "**"`.

### 4.5 Rendering a výkon

- Globus zůstává v layoutu `(map)`, stránky mu jen posílají focus (`<MapFocus>`).
- Rozpočet: LCP < 2,5 s (mobil 4G), JS první stránky < 200 kB gzip, Lighthouse mobile ≥ 85.
- Barevné mapy pro všechny vrstvy se neposílají v každém RSC payloadu — načítají se líně pro aktivní vrstvu.
- Administrace: `force-dynamic`, `noindex`, `robots: { index: false }`, bez ISR.

---

## 5. Komponenty a UI

### 5.1 Pravidla komponent

| Pravidlo | Proč |
|---|---|
| Server Component je výchozí; `"use client"` jen při stavu, efektech, událostech nebo browser API. | Menší JS, tajemství zůstávají na serveru. |
| Klientská komponenta nedostává celé DB řádky — jen props, které potřebuje. | Únik interních sloupců (owner_id, review_note). |
| Žádné `dangerouslySetInnerHTML` mimo komponentu `<SafeHtml html={…}/>`, která vstup znovu sanitizuje. | Obrana proti XSS i při chybě na vstupu. |
| URL z dat (`href`, `src`, `style: url()`) jen přes `safeUrl()` (povolí `https:`, `mailto:`, relativní cesty). | `javascript:` URL, CSS injection. |
| Interaktivní prvky ≥ 44×44 px, ovladatelné klávesnicí, viditelný focus. | P12 přístupnost. |
| Texty UI v `messages/{locale}.json` (příprava P15), ne natvrdo v komponentě. | Jazykové mutace. |

### 5.2 Katalog komponent

**Veřejná část**

| Skupina | Komponenty | Poznámka |
|---|---|---|
| `components/map/` | `AtlasGlobe`, `MapContext`, `MapFocus`, `MapControls`, `ModeSwitch`, `ViewSwitcher`, `MapLegend` | beze změny architektury; data vrstev z DB |
| `components/portrait/` | `Portrait` (jeden pro region i issue), `IndicatorCards`, `Timeline`, `ThematicEntries`, `VisualCarousel`, `ResourceLibrary`, `FaqList`, `EmptySection`, `PatronsCallout`, `Rail` | sjednotit 4 kopie karuselu do `Rail` (klávesnice, šipky) |
| `features/entries/components/` | `EntryHeader`, `EntryChapter`, `EntryAudio`, `AuthorBio` | P9 |
| `components/` | `ContentRail`, `Header`, `EncyclopediaPanel`, `NewsletterForm`, `SafeHtml` | |

**Administrace** (`app/admin/`, `components/ui` + `components/data-table/DataTable`, ADR-019)

| Sekce (= `role_permissions.section`) | Obrazovky | Datové operace |
|---|---|---|
| `news` | seznam hesel, editor (TipTap), náhled (`draftMode`), historie revizí s obnovou | `entries`, `entry_chapters`, `entry_countries`, Storage |
| `approvals` | fronta ke schválení, detail s diffem, vrátit s poznámkou | RPC `approve_entry`, `send_back_entry`, `unpublish_entry` |
| `regions` | portrét regionu: intro, metriky se zdrojem, timeline, FAQ, zdroje, vizuály | `regions`, `portrait_metrics`, `timeline_events`, … |
| `specials` | global issues: název, barvy, výběr zemí na mapě, portrét | `special_regions`, `special_region_countries` |
| `layers` | ukazatele, ruční hodnoty se zdrojem, palety | `indicators`, `indicator_values`, `indicator_styles` |
| `appearance` | téma webu | `site_theme` |
| `areas` | vlastní mapové oblasti (GeoJSON) | `map_areas` |
| `users` | účty, **pozvánky týmu s rolí**, povolené e-maily, přiřazení schvalovatelů, blokace | `profiles`, `invitations`, `allowed_emails`, `approver_*` |
| `permissions` | role × sekce matice, bezpečnostní nastavení, audit log | `roles`, `role_permissions`, `security_settings`, `audit_log` |
| `members` | členství (read-only z Stripe), bezplatná členství | `members_overview`, `memberships` |

Shell administrace: levé menu generované z `my_permissions()`; sekce bez práva `v` se nezobrazí **a zároveň** je
její stránka chráněná (layout sekce ověří `has_perm`). Každý formulář: `useActionState` + Zod chyby u polí +
potvrzení destruktivních akcí + stav „ukládám“.

### 5.3 Editor obsahu

- **TipTap** s povolenými rozšířeními: nadpisy h2–h4, odstavec, seznamy, tučné/kurzíva, odkaz, citace, tabulka,
  obrázek (jen ze Storage), vložení (jen Flourish/World Bank/YouTube přes schválený node).
- HTML se sanitizuje **při uložení** (Server Action) i **při vykreslení** (`<SafeHtml>`) stejnou allowlistou
  (`lib/security/sanitize.ts`, jediná definice).

---

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

---

## 7. Autentizace, role a oprávnění

### 7.1 Přihlášení

- **Supabase Auth**, dvě metody (obě PKCE flow):

  | Metoda | Pro koho | Kdy |
  |---|---|---|
  | **Přihlásit přes Google** (Supabase OAuth provider) | čtenáři i tým | **hned** — nepotřebuje vlastní SMTP ani doménu |
  | **Vlastní e-mail** — registrace a přihlášení kódem/magic linkem (bez hesla) | čtenáři i tým | po zřízení vlastního SMTP s ověřenou doménou (do té doby je v UI skrytá) |

- Google OAuth: OAuth klient v Google Cloud (typ *Web application*), redirect URI
  `https://<ref>.supabase.co/auth/v1/callback`; scopes jen `openid email profile`. Consent screen s názvem
  Atlas, odkazem na privacy policy a ověřenou doménou.
- Identita se páruje **podle ověřeného e-mailu**: Google účet a e-mailový účet se stejnou adresou jsou jeden
  uživatel (Supabase automatic identity linking pro ověřené e-maily).
- Session v **HTTP-only cookies** přes `@supabase/ssr`; middleware ji obnovuje. Na serveru se identita ověřuje
  vždy `supabase.auth.getUser()` (ověří JWT u Auth serveru), **nikdy** jen `getSession()`.
- Konfigurace Auth (projekt i `config.toml`):
  - `enable_confirmations = true` (e-mail musí být ověřený),
  - `site_url` = produkční URL; `additional_redirect_urls` jen konkrétní adresy
    (produkce, `http://localhost:3000`, přesný vzor preview domény projektu) — **žádné `https://*.vercel.app`**,
  - **vlastní SMTP** (např. Resend, zdarma 3 000 e-mailů/měsíc) s ověřenou doménou — vestavěný e-mail posílá
    jen členům týmu Supabase, takže e-mailová registrace čtenářů a rozesílání pozvánek se zapnou až s ním,
  - CAPTCHA (Cloudflare Turnstile, zdarma, nativně podporovaná Supabase) na registraci a přihlášení,
  - rate limity Auth ponechat výchozí nebo přísnější,
  - JWT expiry 1 h, rotace refresh tokenů zapnutá; session timebox dle `security_settings.session_hours`.
- `next` parametr po přihlášení projde `safeRedirect()` (jen relativní cesta začínající `/`, ne `//`) — ochrana
  proti open redirectu.
- Odhlášení: Server Action `signOut()` + smazání cookies; blokace účtu navíc volá Auth Admin API (ban), aby
  zanikly i platné tokeny.

### 7.2 Role a oprávnění (model v DB)

- **Matice** `role × sekce × {v,c,e,d}` v `role_permissions`; sekce: `news`, `approvals`, `areas`, `regions`,
  `layers`, `appearance`, `specials`, `users`, `members`, `permissions`.
- **Rozsahy mimo matici**: `roles.news_scope` (`none|own|all`), `roles.approval_scope` (`none|assigned|global`),
  per-uživatel `profiles.approval_global`, přiřazení `approver_countries` / `approver_authors`.
- **Výchozí role**: `admin` (zamčená, vše), `permission-admin`, `content-editor`, `content-approver`, `publisher`,
  `data-editor`, `observer`, `reader`.
- **Invarianty vynucené DB** (musí mít test): nikdo nemění vlastní roli/stav; jen admin přiděluje admina; poslední
  admin nejde odebrat; `permission-admin` nemůže přidat práva vlastní roli; schvalovatel neschvaluje vlastní
  obsah; publikace jen přes `approve_entry()`; audit log je append-only.
- Aplikace volá `my_permissions()` jednou na request v layoutu administrace a výsledek předává menu a stránkám.
  Pro skrytí tlačítek používá tentýž výsledek; **autorizace samotná je vždy na RLS/RPC**.
- **MFA**: role v `security_settings.require_2fa_roles` (admin, permission-admin) musí mít TOTP; vynucuje se
  v DB — `has_perm()` pro tyto role vyžaduje `auth.jwt()->>'aal' = 'aal2'` a UI vyzve k zapsání faktoru.

### 7.3 Registrace čtenářů a pozvánky týmu

Dva druhy účtů (`profiles.kind`), dvě různé cesty vzniku:

| | **Čtenář** (`kind = 'reader'`) | **Interní tým** (`kind = 'staff'`) |
|---|---|---|
| Jak vznikne | **sám se zaregistruje** — Google, později vlastní e-mail | **jen na pozvánku** od člověka s právem `users:c` |
| Role | vždy `reader` (trigger `handle_new_user`) | role určená **v pozvánce** (admin, permission-admin, content-editor, content-approver, publisher, data-editor, observer, případně vlastní role) |
| Přístup do `/admin` | ne (stránka „Nemáte přístup“) | ano, menu a obrazovky podle práv role |
| Může se změnit | admin ho může povýšit jen **novou pozvánkou** na jeho e-mail | role a práva mění admin v sekci Účty / Role |

#### Pozvánka (nová tabulka `invitations`)

| Sloupec | Význam |
|---|---|
| `id uuid`, `email text` (lowercase, CHECK formátu) | koho zveme |
| `role_id → roles` | role, kterou po přijetí dostane |
| `approval_global bool`, `approver_countries text[]`, `approver_authors uuid[]` | volitelně rovnou nastavení schvalování |
| `note text` | interní poznámka (max 300) |
| `invited_by → profiles`, `created_at`, `expires_at` (výchozí **+5 dní**) | kdo a kdy |
| `accepted_at`, `accepted_by → profiles`, `revoked_at` | stav |

- Unikátní **aktivní** pozvánka na e-mail (partial unique index `where accepted_at is null and revoked_at is null`).
- **RLS**: číst/vytvářet/odvolávat smí jen `users:v/c/e`; pozvaný pozvánku nevidí.
- **Stejná pravidla jako u změny role** (hlídá trigger, `SECURITY DEFINER`): zamčenou roli (`admin`) smí
  pozvat jen admin; roli se sekcemi `users`/`permissions` smí pozvat jen admin; nikdo nepozve roli „vyšší“,
  než sám může přidělit. Všechny akce jdou do `audit_log`.
- **Přijetí** — funkce `claim_invitation()` (`SECURITY DEFINER`), volaná automaticky v `handle_new_user`
  a v `/auth/callback` po každém přihlášení:
  1. vezme e-mail přihlášeného uživatele **jen pokud je ověřený** (`auth.users.email_confirmed_at is not null`;
     Google e-maily ověřené jsou),
  2. najde aktivní, neexpirovanou pozvánku se shodným e-mailem,
  3. nastaví `profiles.kind = 'staff'`, `role_id`, schvalovací přiřazení, označí pozvánku jako přijatou, zapíše audit.
- **Doručení pozvánky:**
  - **teď (bez vlastního SMTP):** admin v administraci vytvoří pozvánku a zkopíruje odkaz
    `/pozvanka` s instrukcí „přihlaste se přes Google e-mailem X“. Odkaz nenese žádné tajemství — oprávnění
    je vázané na **ověřený e-mail**, ne na znalost odkazu. Odešle ho vlastním e-mailem/chatem.
  - **po zřízení SMTP:** Server Action po zápisu pozvánky (pod session admina → RLS ověří `users:c`)
    zavolá `auth.admin.inviteUserByEmail()` se servisním klíčem; pozvaný si nastaví přihlášení z e-mailu.
- `allowed_emails` zůstává jako volitelné **doménové omezení** pro tým — **rozhodnuto: nepoužívat** (tým může mít libovolné e-maily);
  s `invite_only = true` nejde pozvat e-mail mimo seznam.
- Admin pozvánky vidí v sekci **Účty → Pozvánky**: stav, expirace, odvolat, poslat znovu.

#### Změna rolí a práv týmu

- Sekce **Účty** (`users`): seznam, změna role, schvalovací přiřazení, blokace (+ ban v Auth API), pozvánky.
- Sekce **Role a práva** (`permissions`): matice role × sekce × `vced`, rozsahy `news_scope` / `approval_scope`,
  vlastní role, bezpečnostní nastavení, audit log.
- Invarianty ze 7.2 platí beze změny (nikdo nemění sám sebe, poslední admin, permission-admin nepřidá práva
  vlastní roli…).
- **První admin**: po prvním přihlášení zakladatele přes Google se mu role `admin` nastaví jednorázově
  skriptem se servisním klíčem (`npm run db:make-admin -- email@…`); další admini už jen pozvánkou.

#### Ochrana registrace čtenářů

- Google: bez CAPTCHA (ověřuje Google). E-mailová registrace: Turnstile CAPTCHA + potvrzení e-mailu + rate limity Auth.
- Čtenář nemá žádná práva k zápisu obsahu — i masová registrace nemůže změnit web.

### 7.4 Veřejný přístup

- Nepřihlášený návštěvník: jen `select` publikovaného obsahu (RLS), žádné zápisy.
- Přihlášený `reader`: totéž + vlastní profil, členství, odběr novinek.
- `/admin` bez přihlášení → přesměrování na `/login?next=/admin` (už ne 404); přihlášený čtenář bez týmové
  role → stránka „Nemáte přístup“ (403).

---

## 8. Bezpečnostní standardy

Cílová úroveň: **OWASP ASVS 4.0 Level 2** pro administraci a API, Level 1 pro veřejný web.
Každý bod má kontrolu v testech nebo v CI (sloupec „Ověření“).

### 8.1 Přehled kontrol

| # | Oblast | Standard | Ověření |
|---|---|---|---|
| S1 | Autorizace | RLS na každé tabulce; mutace jen přes RLS/RPC; handler ověřuje identitu sám | DB testy matice rolí (9.3) |
| S2 | Autentizace | Google OAuth / e-mailový kód, jen ověřené e-maily, CAPTCHA u e-mailové registrace, tým jen na pozvánku vázanou na ověřený e-mail, MFA pro admin role, `getUser()` na serveru | e2e přihlášení, DB test pozvánek, test MFA |
| S3 | Validace vstupu | Zod na každé hranici (formulář, query, JSON, webhook, env), délkové limity shodné s DB CHECK | unit testy schémat |
| S4 | Výstup / XSS | React escapuje; HTML jen přes `sanitize-html` allowlist při uložení i vykreslení; `jsonLdHtml` escapuje `<` | test s XSS payloady |
| S5 | URL | `safeUrl()` pro `href`/`src`/CSS; DB CHECK `^https://` na URL sloupcích | unit + DB test |
| S6 | Open redirect | `safeRedirect()` pro `next`/`redirectTo` | unit test |
| S7 | CSRF | Server Actions (Next ověřuje Origin); Route Handlers s cookie auth ověřují `Origin`; cookies `SameSite=Lax` | e2e test cizího Origin |
| S8 | Hlavičky | CSP z `lib/security/csp.ts` (v produkci bez `unsafe-eval`; `unsafe-inline` ve script-src viz ADR-012), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `frame-ancestors 'none'` | unit test CSP + smoke test hlaviček |
| S9 | Rate limiting | sdílené úložiště (tabulka `rate_limits` v Postgres nebo Upstash Free) — ne paměť procesu | integrační test |
| S10 | Tajné údaje | jen server; `server-only`; GitHub secret scanning + push protection; `grep` bundlu v CI | CI krok |
| S11 | Závislosti | Dependabot (týdně), `npm audit --audit-level=high` v CI, CodeQL (zdarma pro veřejné repo), zamčené verze | CI |
| S12 | Soubory | Storage RLS, cesta `{user_id}/…`, MIME allowlist bez SVG, limit velikosti | DB test Storage |
| S13 | Iframes | jen Flourish/World Bank/YouTube, `sandbox` bez `allow-same-origin`, `loading="lazy"`, CSP `frame-src` | smoke test |
| S14 | SSRF | server nikdy nestahuje URL zadanou uživatelem (výjimka: importní skript s allowlistem hostů) | code review |
| S15 | Chyby a logy | uživateli obecná hláška + ID; detail do logu; v logu žádné tokeny, hesla, celé e-maily | code review |
| S16 | Soukromí (GDPR) | privacy policy před newsletterem/platbami; minimalizace osobních údajů; retence audit logu 12 měsíců; `page_views_daily` jen agregovaně | checklist 13.5 |
| S17 | Admin | `noindex`, `force-dynamic`, žádné odkazy na admin z veřejných stránek, session timebox | smoke test |
| S18 | Obrazový optimizer | `images.remotePatterns` jen konkrétní hosty | smoke test (cizí host → 400) |

### 8.2 Content Security Policy (cíl)

```
default-src 'self';
script-src 'self' 'unsafe-inline' blob:;                           # bez nonce — ADR-012
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;      # Tailwind/MapLibre inline styly
img-src 'self' data: blob: https://*.supabase.co https://server.arcgisonline.com https://api.maptiler.com;
font-src 'self' https://fonts.gstatic.com data:;
connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co https://*.arcgisonline.com
            https://fonts.openmaptiles.org https://api.maptiler.com https://challenges.cloudflare.com;
frame-src https://flo.uri.sh https://public.flourish.studio https://*.worldbank.org
          https://www.youtube-nocookie.com https://challenges.cloudflare.com;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

CSP skládá `buildCsp()` v `lib/security/csp.ts`; middleware ji posílá s každou odpovědí. Nonce záměrně
nepoužíváme (ADR-012). Nová externí služba = změna CSP v `lib/security/csp.ts` + test.

### 8.3 Sanitizace HTML (jediná allowlist)

- Tagy: `h2 h3 h4 p blockquote ul ol li strong em a code pre hr br table thead tbody tr th td figure figcaption img sup sub`.
- Atributy: `a[href,title]`, `img[src,alt,title,width,height]`; schémata `https`, `mailto`; `img` jen ze Supabase Storage.
- Odkazy dostanou `rel="noopener noreferrer"`, externí `target="_blank"`.
- Vložené iframy nejsou v HTML — ukládají se jako strukturovaná data (`visual_embeds`) a vykresluje je komponenta.

### 8.4 Bezpečnostní proces

- Každý PR, který mění auth, RLS, migrace, middleware nebo `lib/security`, má v popisu sekci **Security impact**
  a vyžaduje review (CODEOWNERS).
- Před každým větším vydáním: projít kapitolu 8 a `docs/architektura-nalezy.md`, doplnit testy.
- Hlášení zranitelností: `SECURITY.md` s kontaktem (veřejné repo).
- Incident (únik klíče, zneužití účtu): rotace klíčů, ban účtu, revert obsahu z revizí, zápis do incident logu.

---

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

---

## 10. CI/CD a provoz

### 10.1 Pipeline (GitHub Actions)

```
PR:   install (npm ci) → typecheck → lint → unit → db tests (PGlite) → integrace (supabase start)
      → build → deploy preview (dev DB) → e2e + axe proti preview → Lighthouse (varování)
main: totéž bez preview → supabase db push (produkce) → vercel deploy --prod → smoke test produkce
noc:  zašifrovaná záloha DB · npm audit · CodeQL
```

- Workflow soubory: `ci.yml` (PR), `deploy.yml` (main), `nightly.yml`.
- `main` je chráněná: merge jen přes PR se zelenými checky; žádné force-push (výjimka jen s dohodou vlastníka).
- Nasazení na Vercel jde **výhradně** z Actions přes `VERCEL_TOKEN` (Vercel Git integrace je vypnutá).
- Pořadí na `main`: **migrace před nasazením aplikace**; proto musí být migrace zpětně kompatibilní (6.3).
- Deploy nesmí mít ruční kroky; rollback = `vercel rollback` + případná opravná migrace.

### 10.2 Provoz a monitoring

- Logy: Vercel runtime logs (Hobby: 1 h) → pro koncept dostačující; pro provoz napojit Sentry (Free) na chyby.
- Uptime: Supabase Free se uspí po 7 dnech bez provozu → noční workflow provede lehký dotaz (udržuje projekt aktivní)
  a zároveň slouží jako health check.
- Audit log a revize jsou nástroj pro vyšetření změn obsahu.
- Metriky výkonu: Vercel Speed Insights (Free) nebo Lighthouse CI historie.

---

## 11. Rozhodnutí (ADR)

| ID | Rozhodnutí | Důvod | Alternativy |
|---|---|---|---|
| ADR-001 | Obsah v Supabase Postgres, autorizace v RLS | role a schvalování potřebují vynucení na straně dat; jeden zdroj pravdy | Payload CMS, git-based CMS |
| ADR-002 | Mutace přes Server Actions, čtení přes Server Components + `unstable_cache` s tagy | žádná vlastní REST vrstva, typově bezpečné, CSRF ochrana od Next | Route Handlers pro vše |
| ADR-003 | Veřejné čtení anon klíčem (RLS), ne servisním klíčem | least privilege; chyba v dotazu nemůže odhalit neveřejná data | servisní klíč na serveru (původní brief P2) |
| ADR-004 | Google OAuth hned, e-mailový kód/magic link po zřízení SMTP; bez hesel | Google nepotřebuje SMTP ani doménu; žádná správa hesel | e-mail + heslo |
| ADR-005 | Fulltext v Postgres (tsvector + GIN) místo MiniSearch v paměti | index sdílený instancemi, vždy aktuální | MiniSearch přestavěný při ISR, Algolia |
| ADR-006 | Čtenáři se registrují sami (role `reader`), interní tým jen na pozvánku s rolí; pozvánka vázaná na ověřený e-mail, ne na tajný odkaz | kdokoli se přihlásí, ale obsah mění jen pozvaní; funguje i bez vlastního SMTP | ADMIN_TOKEN (sdílené heslo), 404; otevřená role pro všechny |
| ADR-007 | Dva Supabase projekty (prod + dev) | testy a preview nesahají na produkční data | jeden projekt, Supabase branching (Pro) |
| ADR-008 | Vercel Hobby + Supabase Free pro koncept, před komerčním spuštěním Pro | náklady; Hobby zakazuje komerční použití | Pro hned |
| ADR-009 | Veřejný GitHub repozitář | Vercel Hobby jinak blokuje nasazení od více autorů; zdarma CodeQL a secret scanning | soukromé repo + Vercel Pro |
| ADR-010 | TipTap + sanitizace na serveru při uložení i vykreslení | bezpečný WYSIWYG, strukturovaný výstup | Markdown editor |
| ADR-011 | Rate limiting v Postgres (`rate_limits` + funkce) | žádná další služba; sdílené mezi instancemi | Upstash Redis Free |
| ADR-012 | CSP bez nonce: `script-src 'self' 'unsafe-inline'`, v produkci bez `unsafe-eval` | nonce vyžaduje dynamické renderování každé stránky → konec statických/ISR stránek; XSS řeší sanitizace (8.3) a zákaz `dangerouslySetInnerHTML` mimo `SafeHtml` | nonce + dynamické renderování; SRI hash (experimentální v Next 15) — přehodnotit s Next 16 |
| ADR-013 | *(nahrazeno ADR-017)* Zůstat na MapLibre 5 s výjimkou v auditu (GHSA-jrc7-96c5-q579) | zranitelnost je v `DOM.sanitize`, kterou v5 volá jen pro náš pevný atribuční text; MapLibre 6 v bundleru Next nenačte web worker (hranice zemí se nevykreslí) | MapLibre 6 s vlastním načítáním workeru (úkol A9) |
| ADR-014 | *Návrh (čeká na schválení vlastníka):* rozpočet JS 550 kB (přenos, gzip, včetně workeru MapLibre) místo 200 kB; LCP < 2,5 s beze změny | MapLibre 6 má ~300 kB gzip (hlavní modul + sdílený modul + worker, načítá se za běhu z `public/` a sdílený modul jen jednou — ADR-017), aplikace ~220 kB; globus je jádro produktu a LCP neblokuje; `lighthouserc.json` hlídá, aby JS nerostl | 200 kB s líným načtením globusu až po interakci — horší první dojem z mapy |
| ADR-015 | Plánované publikování přes pg_cron v DB (`publish_due_entries()` každých 5 min), ne přes Vercel Cron | Vercel Hobby pouští cron jen 1× denně; route by potřebovala servisní klíč a `CRON_SECRET`; v DB stav mění jen security definer funkce se stejným pravidlem jako `approve_entry` | Vercel Cron `/api/cron/publish` s `CRON_SECRET` + `revalidateTag` (přesnější obnovení cache, ale denní interval na Hobby) |
| ADR-016 | Náhled nezveřejněného článku přes odkaz s tokenem (`preview_links`, RPC `entry_preview`), ne přes `draftMode` | jedna cesta pro redakci i lidi bez účtu; veřejné stránky zůstávají čistě ISR (žádná cookie draftMode nepřepíná cache); v DB jen SHA-256 tokenu, platnost 1–30 dní, vytvořit smí jen kdo článek upravuje/schvaluje. Autosave editoru jen do prohlížeče (localStorage) — každé uložení do DB je revize | `draftMode` + `/api/draft` (jen pro přihlášené, sdílení by stejně chtělo token); autosave na server (zahltil by historii revizí) |
| ADR-017 | MapLibre 6 s workerem ze statického souboru (`public/maplibre/<verze>/`, `setWorkerUrl`); nahrazuje ADR-013 | MapLibre 6 hledá worker vedle svého modulu (`import.meta.url`), což bundler Next rozbije; kopie při `predev`/`prebuild` je jednoduchá, verze v cestě dovolí dlouhou cache; e2e hlídá, že se worker stáhne a hranice zemí načtou | zůstat na v5 s výjimkou v auditu; vlastní webpack pravidlo pro worker (křehké mezi verzemi Next) |
| ADR-018 | Jazyky: veřejné routy pod `[locale]`, angličtina bez předpony (proxy přepíše na `/en/…`, `/en/…` přesměruje 308), další jazyky s předponou; překlady polí v tabulce `translations` s fallbackem na angličtinu; texty UI v `messages/*.json` bez knihovny (typová kontrola klíčů) | stávající URL a SEO beze změny; ISR po jazycích; žádná nová závislost; `<html lang>` zůstává společné, jazyk obsahu nese obal `lang` | `next-intl` (zbytečně velké pro dva jazyky a vlastní routing); jazyk z cookie bez předpony (nejde cachovat ani indexovat) |
| ADR-019 | Jediná tabulka administrace `components/data-table/DataTable` převzatá z TealHubu (vlastní implementace bez TanStack Table): jedna CSS mřížka na sémantické `<table>`, řádky jako data (hodnoty + volitelně předvykreslené buňky a akce), hledání/filtry/řazení/CSV v prohlížeči, předvolby uživatele v localStorage přes `useSyncExternalStore`; matice oprávnění ukládá každé kliknutí přes stávající `saveMatrix` | serverové stránky předají řádky rovnou klientské tabulce bez souboru se sloupci na každou stránku; žádná nová závislost (TealHub také bez TanStack, jen Radix, který Atlas nemá — popover a dialog jsou vlastní na nativních prvcích); export CSV je přesně to, co je vidět | TanStack Table (původní plán 5.2/15.1 — další závislost a funkce v definicích sloupců, které ze Server Component nejdou předat); stránkování a filtry jen na serveru (pomalejší, nejde exportovat výběr) |

Nové rozhodnutí = nový řádek (další číslo), nikdy přepsání starého; zrušené označit „nahrazeno ADR-xxx“.

---

## 12. Plán realizace

Každá fáze končí zeleným CI a nasazením. Čísla `SEC-xx` / `DB-xx` odkazují na neveřejný seznam nálezů.
**Podrobný rozpis úkolů, milníky a stav: [`PLAN-REALIZACE.md`](PLAN-REALIZACE.md).**

### Fáze A — Základ (≈ 2 dny)

- ESLint + Prettier, Vitest, skripty `typecheck`, `lint`, `test`; CI `ci.yml` spouští vše z 9.1 kromě e2e.
- `lib/env.ts`, `lib/security/*` (sanitize, safeUrl, safeRedirect, csp) s unit testy.
- CSP s nonce, HSTS, oprava `images.remotePatterns` (SEC-01), odebrání veřejného exportu (SEC-04),
  odkazů na admin z veřejných stránek.
- **Hotovo, když:** CI běží na PR, smoke test hlaviček prochází, žádný `unsafe-eval`.

### Fáze B — Databáze připravená pro aplikaci (≈ 2 dny)

- Migrace s opravami nálezů `DB-01` až `DB-12` (guard triggery `SECURITY DEFINER`, oddělené `delete` politiky,
  URL CHECK, indexy FK, veřejná view bez interních sloupců, oprávnění autorů, …).
- Tabulka `invitations` + `claim_invitation()` + trigger pravidel pozvánek, úprava `handle_new_user`,
  skript `db:make-admin`; tabulka `rate_limits`.
- `portrait(slug)` a `search(q)` funkce, `tsvector` na `entries`.
- `supabase gen types`, `authz-matrix.json` + parametrický test.
- Auth konfigurace: potvrzování e-mailu, redirect URL bez wildcardu, SMTP, Turnstile (SEC-05, SEC-06).
- **Hotovo, když:** `npm run test:db` pokrývá matici rolí a všechny DB-xx mají test.

### Fáze C — Přihlášení (≈ 2 dny)

- `@supabase/ssr` klienti, middleware obnovy session, `/login` (e-mail OTP + Google), `/auth/callback`,
  `/auth/confirm`, odhlášení, `safeRedirect`.
- Odstranit `ADMIN_TOKEN` a 404 gate; `/admin` → login.
- Google OAuth klient (Google Cloud) + zapnutí provideru v Supabase; e-mailová registrace skrytá do zřízení SMTP.
- Sekce Účty → Pozvánky (vytvořit, zkopírovat odkaz, odvolat, poslat znovu).
- **Hotovo, když:** e2e: čtenář se zaregistruje přes Google → nemá přístup do `/admin`; admin pozve e-mail
  s rolí `publisher` → pozvaný se přihlásí → vidí jen sekce své role; pozvánka s neověřeným e-mailem se nepřijme.

### Fáze D — Veřejný web čte z DB (≈ 3–4 dny)

- `features/*/queries.ts` s cache tagy; nahrazení čtení `src/content/**` a `global-issues.json`.
- Vyhledávání přes `search()`; sitemap z DB (vč. global issues, `lastmod`).
- Smazat `src/content/**` (po ověření, že seed obsahuje vše).
- **Hotovo, když:** smoke + e2e zelené, `src/content` neexistuje, Lighthouse v rozpočtu.

### Fáze E — Administrace ukládá do DB (≈ 8–10 dní)

1. Shell + menu z `my_permissions()`.
2. Hesla: TipTap, obrázky do Storage, stavy, odeslání ke schválení, fronta schválení, vrácení s poznámkou,
   historie revizí s obnovou, náhled (`draftMode`).
3. Regiony a global issues (portrét: intro, metriky, timeline, FAQ, zdroje, vizuály).
4. Ukazatele a ruční hodnoty se zdrojem, palety, vzhled.
5. Účty, role a matice oprávnění, bezpečnostní nastavení, audit log (jen pro admina).
- **Hotovo, když:** každá obrazovka má integrační test „bez práva / s právem“ a e2e hlavní tok.

### Fáze F — Provozní připravenost (≈ 1–2 dny)

- Noční zálohy, keep-alive, Dependabot, CodeQL, `SECURITY.md`, CODEOWNERS, ochrana `main`.
- Privacy policy (před zapnutím newsletteru), retence audit logu.

---

## 13. Postupové standardy (checklisty)

### 13.1 Definition of Done (každý PR)

- [ ] Typecheck, lint, unit, DB testy, build zelené v CI.
- [ ] Nový vstup má Zod schéma s limity shodnými s DB.
- [ ] Nová data mají RLS a DB test (anon / s právem / bez práva).
- [ ] Žádné tajemství v kódu, žádný nový `NEXT_PUBLIC_` s citlivou hodnotou.
- [ ] Mutace invaliduje správné cache tagy.
- [ ] UI: klávesnice, focus, 44 px cíle, texty v `messages/`.
- [ ] Popis PR: co, proč, jak otestováno, **Security impact** (pokud relevantní).
- [ ] Nová závislost má zdůvodnění.

### 13.2 Přidání tabulky

1. `supabase migration new <nazev>`.
2. Tabulka dle 6.2 (CHECK, `updated_at`, indexy FK), `enable row level security`, politiky pro každý příkaz zvlášť, granty.
3. Audit trigger, pokud jde o oprávnění, účty nebo stav obsahu.
4. DB test + řádek v `authz-matrix.json`.
5. `supabase gen types`, commit typů.
6. Seed (pokud potřebuje výchozí data) přes `build-seed.mjs`.

### 13.3 Přidání obrazovky administrace

1. Sekce existuje v `role_permissions.section` (jinak nejdřív migrace).
2. `features/<doména>/schema.ts` → `queries.ts` → `actions.ts` (vzor 4.3) → `components/`.
3. Stránka v `app/admin/<sekce>/` ověří `has_perm(sekce,'v')` v layoutu.
4. Formulář přes `useActionState`, chyby u polí, potvrzení mazání.
5. Integrační test akce + e2e hlavní tok.

### 13.4 Přidání veřejné stránky

1. Server Component, data z `queries.ts` přes anon klienta s cache tagy.
2. `generateMetadata` (title, description, canonical, OG), JSON-LD přes `jsonLdHtml`.
3. Sitemap, pokud je indexovatelná.
4. Smoke test (200 + klíčový obsah), e2e pokud je interaktivní.

### 13.5 Přechod z konceptu do produkce

- [ ] Přezkum týmových účtů a jejich rolí, odvolání nepřijatých pozvánek, obsah zkontrolován proti revizím/audit logu.
- [ ] Vlastní SMTP zapnuté (e-mailová registrace čtenářů, pozvánky e-mailem), Google OAuth consent screen ověřený.
- [ ] Supabase Pro + Vercel Pro (komerční použití), vlastní doména, HSTS preload.
- [ ] Privacy policy, cookie-less analytika, retence dat.
- [ ] MFA pro všechny redakční role, přezkum `allowed_emails`.
- [ ] Rotace všech klíčů použitých během konceptu.

### 13.6 Commity a větve

- Větev `feat/…`, `fix/…`, `chore/…` z `main`; PR malý a jednoúčelový.
- Commit zpráva v češtině, první řádek ≤ 72 znaků, v rozkazovacím nebo popisném tvaru („Přidej …“ / „Oprava …“).
- Migrace a kód, který ji potřebuje, ve stejném PR.

---

## 14. Otevřené otázky

1. **Doména pro e-maily (SMTP)**: kdo spravuje DNS `atlasoftodaysworld.org`? Bez ověřené domény nelze posílat
   přihlašovací e-maily neomezenému okruhu lidí → do té doby použít přihlášení přes Google.
2. ~~Druhý Supabase projekt (dev)~~ — **založen 2026-09-30** (`atlas-dev`, Frankfurt).
3. **Google Cloud projekt** pro OAuth klienta — kdo ho založí a pod jakým účtem (doporučeno účet organizace Atlas).
4. ~~Platnost pozvánky a doménové omezení~~ — **rozhodnuto 2026-09-30:** 5 dní, bez omezení domény.
5. **Jazyky** (P15) a **audio** (R4) — potvrzení rozsahu před návrhem tabulky `translations` a bucketu `audio`.
6. **Platby** — Stripe Payment Links (brief) vs. hosted Checkout + webhook (plán provozu).

---

## 15. Jednotnost komponent a deduplikace

Cíl: **každý vizuální vzor, konstanta a datová definice existuje v kódu právě jednou.** Nová obrazovka se
skládá z hotových dílů; když díl chybí, vznikne jako sdílený, ne jako kopie.

### 15.1 Hierarchie sdílených dílů (odkud brát, v tomto pořadí)

| Úroveň | Kde | Co tam patří |
|---|---|---|
| 1. Design tokeny | `src/app/globals.css` (`@theme` v Tailwind 4) + `src/config/layout.ts` | barvy, radiusy, stíny, typografie, **rozměry layoutu** (`--rail-width`, `--rail-width-wide`, `--header-h`, `--touch-min: 44px`) |
| 2. Primitiva | `src/components/ui/` (shadcn/ui) | `Button`, `IconButton`, `Input`, `Select`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`, `Badge`, `Card`, `Skeleton`, `Form*` |
| 3. Vzory Atlasu | `src/components/atlas/` | `Rail` (jediný karusel), `Section`, `SectionLabel`, `MetricCard`, `EmptySection`, `PatronsCallout`, `SafeHtml`, `ExternalLink`, `Breadcrumbs` |
| 4. Doménové bloky | `src/components/portrait/`, `features/*/components/` | `Portrait` (region **i** global issue), `CountryCard`, `EntryHeader`… |
| 5. Stránky | `src/app/**` | jen skládání bloků + data; žádné vlastní styly nad rámec rozvržení |

Pravidla:

- **Než vytvoříš komponentu, hledej** v úrovních 1–4 (podle názvu i podle tříd). Existuje-li podobná,
  rozšiř ji o variantu, nevytvářej novou.
- **Varianty přes `cva`** (class-variance-authority, standard shadcn) — `variant`, `size`, `tone`; ne
  kopírováním dlouhých `className`. Opakovaný řetězec delší než ~6 utilit = signál pro variantu.
- **Žádná magická čísla v komponentách**: rozměry panelů, breakpointy a z-indexy jen z tokenů. JS, který
  potřebuje rozměr (např. padding globusu), ho čte z `config/layout.ts`, ze kterého vznikají i CSS proměnné.
- **Jedna datová definice**: navigace (`src/config/navigation.ts`) pro všechna menu (desktop, mobil, stránky
  bez globusu, patička); kategorie, sekce oprávnění, typy zdrojů — z DB typů nebo jednoho `const`, nikdy
  opsané do komponenty.
- **Stejná data = stejná komponenta**: region a global issue mají stejné sekce → jedna `Portrait` s propsem
  `subject: { kind: "region" | "issue", … }`.
- **Formuláře administrace** z jednoho vzoru: `FormField` (label + control + chyba ze Zod) + `useActionState`;
  tabulky z jednoho `DataTable` (`components/data-table`, ADR-019) s konfigurací sloupců.
- **Klientské volání serveru** jen přes Server Actions nebo jeden `apiFetch()` helper (timeout, chyby) —
  ne ručně psaný `fetch` v každé komponentě.
- **Ikony** z jedné sady (`lucide-react`), ne vložené SVG v každém souboru.
- **Texty** z `messages/{locale}.json`; opakovaný text (CTA, chybové hlášky) má jeden klíč.

### 15.2 Nástroje, které duplicitu hlídají (CI)

| Nástroj | Co hlídá | Práh |
|---|---|---|
| `jscpd` | copy-paste bloky v `src/` | selže nad 1 % duplicit nebo u bloku ≥ 30 řádků |
| `knip` | nepoužité soubory, exporty, závislosti | 0 nálezů (výjimky v `knip.json` s komentářem) |
| ESLint `no-restricted-imports` | import interních souborů cizí domény; `@supabase/supabase-js` mimo `lib/supabase` | chyba |
| ESLint `no-restricted-syntax` | `dangerouslySetInnerHTML` mimo `SafeHtml`; `fetch(` v `components/` | chyba |
| `prettier-plugin-tailwindcss` | jednotné řazení tříd (snazší hledání duplicit) | formát |
| Storybook (nebo Ladle) | katalog dílů úrovně 2–4 → je vidět, co existuje | každý sdílený díl má story |

### 15.3 Známé duplicity k odstranění (stav 2026-09-30)

| # | Duplicita | Cíl |
|---|---|---|
| D1 | Šířka panelu natvrdo na 4 místech (`ContentRail`, `Header`, `MapControls`, `AtlasGlobe`: `27rem`/`432`, `46rem`/`52vw`) | tokeny `--rail-width(-wide)` + `config/layout.ts` |
| D2 | 4 karusely v `PortraitSections` (`Timeline`, `ThematicEntries`, `VisualCarousel`, `ResourceLibrary`) + `NewsTabs` | jeden `Rail` (šipky, klávesnice, snap) |
| D3 | Stránka global issue (218 ř.) skládá portrét znovu místo `RegionPortrait` | jedna `Portrait` |
| D4 | Menu definované 2× (`Header.tsx` pole `NAV`, `(pages)/layout.tsx` natvrdo) | `config/navigation.ts` |
| D5 | ≥ 7 ručních variant primárního tlačítka, přestože existuje `PrimaryButton` | `ui/Button` s variantami |
| D6 | `fetch` ručně v 7 klientských komponentách (admin formuláře, newsletter, search, login) | Server Actions / `apiFetch` |
| D7 | Tři admin formuláře (530, 664, 357 ř.) s vlastní validací a stavem | `FormField` + Zod + `useActionState`, `DataTable` |
| D8 | Obsah renderuje aplikace i `demo/` zvlášť | demo jen jako prezentace nad exportem, nebo zrušit |

---

## 16. Další standardy správné webové aplikace

Doplňky, které má mít produkční webová aplikace. Stav: ✅ máme · 🟡 částečně · ⬜ chybí.

### 16.1 Kvalita kódu a vývoj

| Stav | Standard |
|---|---|
| ✅ | TypeScript `strict` |
| ⬜ | `noUncheckedIndexedAccess`, Next `typedRoutes` (typově kontrolované odkazy) |
| ✅ | ESLint + Prettier + `lint-staged`/`husky` pre-commit |
| ✅ | `.nvmrc` / `engines` — jedna verze Node lokálně i v CI |
| ⬜ | Conventional Commits + automatický CHANGELOG (release-please) |
| ✅ | PR šablona (co / proč / jak testováno / Security impact) a CODEOWNERS |
| ✅ | Dependabot nebo Renovate (seskupené aktualizace, týdně) |
| 🟡 | Rozpočet JS v CI (Lighthouse `resource-summary:script:size`, ADR-014); analyzer zvlášť |

### 16.2 Uživatelské minimum

| Stav | Standard |
|---|---|
| ✅ | Vlastní `not-found.tsx`, `error.tsx`, `global-error.tsx` s cestou zpět na mapu (skutečná 404 i pod `loading.tsx`) |
| 🟡 | `loading.tsx` / skeletony na každé datové stránce (zatím jen část rout) |
| ✅ | Režim údržby (feature flag `maintenance`) |
| ✅ | Právní stránky: Privacy policy, Terms, Accessibility; cookie-less analytika = bez cookie lišty |
| 🟡 | GDPR: export (`/api/account/export`) a smazání vlastního účtu na stránce účtu; retence dat zbývá popsat |
| 🟡 | E-mailové šablony Auth EN/CS připravené (`supabase/templates`, G1), zapnou se se SMTP (U5) |
| ✅ | Přístupnost: skip-link, focus trap v dialozích, axe v CI, prohlášení o přístupnosti, `lang` jazykových verzí |
| ✅ | SEO: OG obrázky přes `next/og`, hreflang (en/cs), sitemap z DB s jazykovými verzemi |
| ✅ | Tisková verze (`@media print`: jen obsah panelu, u odkazů adresa) |

### 16.3 Redakce a obsah

| Stav | Standard |
|---|---|
| ✅ | Sdílitelný náhled nepublikovaného obsahu s expirací (ADR-016) |
| ✅ | Plánované publikování (`publish_at` + pg_cron, ADR-015) |
| ✅ | Automatické ukládání konceptu v editoru + varování při odchodu z neuložené stránky |
| ✅ | Správa přesměrování (tabulka `redirects` → uplatní se místo stránky 404) při změně slugu |
| ✅ | Kontrola odkazů (týdenní job `links.yml` hlásí mrtvé odkazy na stránkách ze sitemap) |
| ⬜ | Povinné alt texty a kredity u každého obrázku |

### 16.4 Provoz a spolehlivost

| Stav | Standard |
|---|---|
| ✅ | Health endpoint `/api/health` (DB dostupná, verze buildu) |
| ⬜ | Error tracking (Sentry Free) se source mapami, bez osobních údajů — čeká na účet (U7) |
| ✅ | Cookie-less analytika (Vercel Web Analytics) |
| ⬜ | Uptime monitor (UptimeRobot Free) na web a health endpoint — vlastník (U6) |
| ✅ | Feature flagy v DB (`feature_flags`: maintenance, newsletter, email_auth) |
| ✅ | Runbook incidentů (únik klíče, výpadek Supabase, zneužití účtu) v `docs/` |
| 🟡 | Šifrovaná záloha DB denně (`backup.yml`); test obnovy 1× za čtvrtletí podle runbooku |

### 16.5 Bezpečnost nad rámec kapitoly 8

| Stav | Standard |
|---|---|
| ✅ | `SECURITY.md` + `/.well-known/security.txt` |
| 🟡 | GitHub: ochrana `main` (povinné CI, lineární historie), CodeQL (výchozí nastavení GitHubu); povinné review a secret scanning nastavuje vlastník |
| ✅ | Žádné skripty z cizích CDN (fonty přes `next/font`, worker MapLibre z `public/`) |
| 🟡 | Rotace klíčů (servisní klíč, Vercel token) — postup v runbooku, provádí vlastník |
| ⬜ | Čtvrtletní revize přístupů (kdo má jakou roli) v sekci Účty |
