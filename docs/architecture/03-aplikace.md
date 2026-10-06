# Aplikační architektura

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

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
