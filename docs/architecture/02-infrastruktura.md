# Infrastruktura a prostředí

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

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
