# Plán realizace — Atlas of Today's World

> Odvozeno z [`ARCHITEKTURA.md`](ARCHITEKTURA.md) a skillu `.claude/skills/atlas-architektura`.
> **Stav:** připraveno k realizaci · **Datum:** 2026-09-30
> Identifikátory `SEC-xx` / `DB-xx` odkazují na neveřejný `docs/architektura-nalezy.md`, `D1–D8` na ARCHITEKTURA 15.3.

## Jak s plánem pracovat

- **Jeden úkol = jedna větev = jeden PR** (`feat/A3-csp-nonce`). PR splňuje Definition of Done (ARCHITEKTURA 13.1).
- Po merge úkol zaškrtni a doplň odkaz na PR. Nové zjištění = nový úkol na konec fáze, ne rozšíření rozdělaného PR.
- Fáze jdou po sobě kvůli závislostem; úkoly **uvnitř** fáze lze dělat paralelně, pokud nemají uvedenou závislost.
- Odhad je v člověkodnech (čd) pro jednoho vývojáře se znalostí stacku.

## Milníky

| Milník | Po fázi | Co uživatel uvidí | Odhad kumulativně |
|---|---|---|---|
| **M1 — Bezpečný základ** | A, A2 | web vypadá stejně, ale CI hlídá kvalitu, opravené bezpečnostní nálezy, sjednocené komponenty | ≈ 6 čd |
| **M2 — Přihlášení** | B, C | přihlášení přes Google, čtenářský účet, pozvánky pro tým, administrace za přihlášením | ≈ 11 čd |
| **M3 — Web z databáze** | D | veřejný obsah se čte ze Supabase, fulltext v Postgres, `src/content` smazaný | ≈ 15 čd |
| **M4 — Administrace ukládá** | E | redakce píše, schvaluje a publikuje hesla, upravuje portréty, data a účty | ≈ 25 čd |
| **M5 — Provozní připravenost** | F | monitoring, zálohy, právní stránky, chybové stránky | ≈ 28 čd |
| **M6 — Rozšíření** | G | e-mailová registrace, náhledy, plánování, hesla P9, jazyky, platby | dle rozsahu |

---

## Předpoklady od vlastníka (blokují uvedené fáze)

| # | Úkol pro vlastníka | Blokuje | Stav |
|---|---|---|---|
| U1 | Google Cloud projekt + OAuth klient (Web); Google provider zapnutý v prod i dev Supabase | C2 | ✅ 2026-09-30 |
| U2 | Druhý Supabase projekt `atlas-dev` (Free, Frankfurt) | B8, E (e2e zápisy) | ✅ založen 2026-09-30 |
| U3 | E-maily adminů (pro `db:make-admin`) | C5 | ✅ 2 admini (v neveřejném `docs/tym.md`) |
| U4 | Platnost pozvánky, doménové omezení týmu | B3 | ✅ 5 dní, bez omezení domény |
| U5 | Přístup k DNS `atlasoftodaysworld.org` pro SMTP (Resend) | G1 | ⬜ |

---

## Fáze 0 — Repozitář a proces (≈ 0,5 čd)

- [x] **0.1** Ochrana `main`: merge jen přes PR se zelenými checky, zákaz force-push, lineární historie.
- [x] **0.2** `.github/pull_request_template.md` (co / proč / jak testováno / Security impact), `CODEOWNERS`
      (`supabase/`, `src/middleware.ts`, `src/lib/security/`, `.github/` → vlastník).
- [x] **0.3** `.nvmrc` (22), `engines` v `package.json`, `SECURITY.md`, `public/.well-known/security.txt`.
- [x] **0.4** Dependabot (npm + GitHub Actions, týdně, seskupené), zapnout secret scanning + push protection, CodeQL.
- [x] **0.5** ~~Úklid `.gitignore`~~ — ověřeno, soubory v `.gitignore` nejsou (chybný nález).
- [x] **0.6** Nasazení v limitu Vercel Hobby (5 000 nahraných souborů/den): build na Vercelu, `.vercelignore`. (#1)
- **Hotovo, když:** PR do `main` bez zelených checků nejde sloučit; CodeQL běží.

## Fáze A — Nástroje a bezpečnostní základ (≈ 3 čd) → M1

- [x] **A1** ESLint (`next/core-web-vitals`, `@typescript-eslint`, `eslint-plugin-security`), Prettier +
      `prettier-plugin-tailwindcss`, `lint-staged` + `husky`; skripty `lint`, `format`, `typecheck`.
- [x] **A2** Vitest (+ `@vitest/coverage-v8`), skript `test`; první testy pro existující `lib/`.
- [x] **A3** `ci.yml`: install → typecheck → lint → unit → `test:db` → build → `jscpd` → `knip`.
      `deploy.yml` nasazuje až po úspěšném `ci.yml`.
- [x] **A4** `src/lib/env.ts` (Zod validace env, pád buildu při chybě).
- [x] **A5** `src/lib/security/`: `sanitize.ts` (jediná allowlist, převzít z `content.ts`), `urls.ts` (`safeUrl`),
      `redirect.ts` (`safeRedirect`), `csp.ts` + 100% unit testy vč. XSS payloadů.
- [x] **A6** Middleware: CSP z `lib/security/csp.ts` (v produkci bez `unsafe-eval`, bez nonce — ADR-012), HSTS, COOP, MapTiler a Supabase v `connect-src` (SEC-07).
- [x] **A7** Rychlé opravy: SEC-01 (`remotePatterns`), SEC-02 (`safeRedirect` v loginu), SEC-04 (export za
      přihlášení/build skript), SEC-05 (`hero` přes `safeUrl`, délkové limity), SEC-08 (odkazy na admin),
      SEC-09 (limit v search, `window.atlasMap`, hláška newsletteru).
- [x] **A8** Smoke test rozšířit o: hlavičky (CSP bez `unsafe-eval`, HSTS), `/_next/image` s cizím hostem → 400,
      `/api/export-demo` → 401/404.
- [x] **A8b** E2E test, že globus opravdu načte hranice zemí (`data-countries="loaded"`) — dosavadní testy rozbitý globus neodhalily.
- [x] **A8c** Zranitelné závislosti: postcss (přes `overrides`), audit v CI přes `audit-ci` se zdokumentovanými výjimkami.
- [ ] **A10** Next 16 + TypeScript 7 (major migrace; Dependabot major verze ignoruje).
- [ ] **A9** MapLibre 6 (oprava GHSA-jrc7-96c5-q579): vyřešit načítání web workeru v bundleru Next (samostatný ES modul `maplibre-gl-worker.mjs`); v izolovaném testu se mapa nedokončí ani mimo Next — prověřit s verzí > 6.11.2. Do té doby výjimka v `audit-ci.jsonc` (ADR-013), přezkum do 2026-12-31.
- **Hotovo, když:** CI zelené, smoke test prochází proti produkci, `lib/security` pokrytí 100 %.

## Fáze A2 — Sjednocení komponent (≈ 3 čd) → M1

Dělá se **před** napojením na DB, aby se komponenty přepisovaly jen jednou.

- [x] **A2.1** Design tokeny: `config/layout.ts` + `@theme` proměnné `--rail-width`, `--rail-width-wide`,
      `--touch-min`; nahradit natvrdo psané rozměry v `ContentRail`, `Header`, `MapControls`, `AtlasGlobe` (**D1**).
- [x] **A2.2** `components/ui/button.tsx` (`cva`: primary/outline/danger/ghost, velikosti vč. `icon`), `lib/cn.ts`;
      ruční tlačítka ve veřejné části nahrazena (**D5**; staré admin formuláře zmizí v E8); `lucide-react` pro ikony.
- [x] **A2.3** `components/atlas/Rail` — jeden karusel (šipky, klávesnice, scroll-snap, `aria-roledescription`);
      přepsat `Timeline`, `ThematicEntries`, `VisualCarousel`, `ResourceLibrary`, `NewsTabs` (**D2**).
- [x] **A2.4** `components/portrait/Portrait` pro region i global issue; stránka global issue ho použije (**D3**).
- [x] **A2.5** `config/navigation.ts` jako jediný zdroj menu (desktop, mobil, `(pages)` layout) (**D4**).
- [x] **A2.6** `SafeHtml` komponenta; ESLint zákaz `dangerouslySetInnerHTML` jinde.
- [ ] **A2.7** Storybook (nebo Ladle) se stories pro `ui/*`, `atlas/*`, `portrait/*`. *(Odloženo na konec fáze E —
      katalog dává smysl, až budou hotové i admin díly `FormField`/`DataTable`.)*
- [x] **A2.8** UX opravy navázané na sjednocení: Esc v inputu nezavírá panel, zoom tlačítka 44 px,
      `prefers-reduced-motion`, focus trap v mobilním menu.
- **Hotovo, když:** `jscpd` < 1 %, D1–D5 odstraněné, Playwright testy zelené, vizuálně beze změny (screenshot porovnání).

## Fáze B — Databáze připravená pro aplikaci (≈ 2,5 čd) → M2

- [x] **B1** Migrace `…_security_fixes.sql`: DB-01 (guardy `SECURITY DEFINER`), DB-03 (politiky zvlášť pro
      každý příkaz), DB-04, DB-05, DB-06 (URL CHECK), DB-08 (veřejná view bez interních sloupců, `unpublish_entry`),
      DB-09 (přechody jen přes RPC, zákaz self-approval), DB-10, DB-13, DB-15, DB-16 (Storage `owner_id` + prefix).
- [x] **B2** Migrace `…_fk_indexes_rate_limits.sql`: DB-12.
- [x] **B3** Migrace `…_invitations.sql`: tabulka `invitations`, RLS, trigger pravidel (kdo koho smí pozvat),
      `claim_invitation()`, úprava `handle_new_user`, audit. *(závisí na U4)*
- [x] **B4** Migrace (spolu s B2): tabulka + funkce `hit_rate_limit(key, limit, window)` (SEC-06).
- [x] **B5** Migrace `…_search*.sql`: `tsvector` + GIN (konfigurace `simple`, bez `unaccent`), RPC `search(q, limit)`
      — kterékoli slovo ≥ 3 znaky, shoda i přes země článku. Funkce `portrait()` přesunuta do D1 (vznikne s dotazy webu).
- [x] **B6** Audit bez PII (jen změněná pole, cíl = id), `purge_audit_log()` pro retenci 12 měsíců (DB-14; plánování v F).
      TOTP MFA zapnuté v obou projektech; **vynucení `aal2` v `has_perm` až s obrazovkou MFA ve fázi E** (jinak by se admini
      odřízli) — úkol E10.
- [~] **B7** `supabase/tests/authz-matrix.json` + parametrický test; testy pro všechny DB-xx a pozvánky
      (včetně „neověřený e-mail pozvánku nepřijme“, „permission-admin nepozve admina“).
      *Hotovo: 17 nových DB testů (každé DB-xx + pozvánky + search + rate limit), celkem 45. Parametrická matice zbývá.*
- [x] **B8** Auth konfigurace v obou projektech *(hotovo 2026-09-30: Google provider, `site_url`, konkrétní redirect URL bez wildcardu `*.vercel.app`, potvrzování e-mailu; zbývá Turnstile, JWT/refresh, `config.toml` a typy)*: `enable_confirmations = true`, redirect URL bez wildcardu (DB-02),
      Turnstile připravené, JWT/refresh nastavení; `supabase gen types` → `src/lib/db/types.gen.ts`. *(dev projekt závisí na U2)*
- [x] **B9** CI: `supabase db push` do produkce v `deploy.yml` před nasazením aplikace (GitHub Secrets
      `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, variable `SUPABASE_PROJECT_REF`).
- **Hotovo, když:** `npm run test:db` pokrývá matici rolí a všechna DB-xx; migrace se aplikují z CI.

## Fáze C — Přihlášení a pozvánky (≈ 2,5 čd) → M2

- [x] **C1** `@supabase/ssr`: `lib/supabase/{server,service,browser,middleware,config}.ts` s `server-only`;
      ESLint zákaz přímého `@supabase/supabase-js` jinde. *(`public.ts` vznikne v D1 s prvním veřejným dotazem — knip.)*
- [x] **C2** Google OAuth: provider v Supabase, `/login` (tlačítko Google; e-mailová varianta skrytá za feature
      flagem), `/auth/callback` (PKCE, `safeRedirect`, volání `claim_invitation()`), odhlášení. *(závisí na U1)*
- [x] **C3** Middleware: obnova session; `/admin/**` bez session → `/login?next=…`; odstranit `ADMIN_TOKEN`,
      cookie `atlas_admin`, `/api/admin/session`, 404 gate (SEC-03).
- [x] **C4** Layout administrace: `getUser()` + `my_permissions()`; čtenář bez týmové role → stránka 403
      „Nemáte přístup“; menu z oprávnění.
- [x] **C5** Skript `npm run db:make-admin -- <email>` (servisní klíč, jen lokálně); nastavit prvního admina. *(závisí na U3)*
- [x] **C6** Minimální sekce **Účty → Pozvánky**: vytvořit (e-mail, role), zkopírovat odkaz,
      odvolat; stránka `/pozvanka` s instrukcí přihlášení. *(Schvalovací přiřazení v pozvánce až v E6.)*
- [x] **C7** Profil čtenáře `/ucet`: jméno, odhlášení, smazání účtu (GDPR).
- [x] **C8** E2E (`tests/auth.spec.ts`, přihlášení magic linkem z Auth Admin API přes `/auth/confirm`): čtenář nemá přístup;
      pozvaný publisher vidí jen své sekce; pozvánka pro jiný e-mail se nepřijme; odhlášení. V CI potřebuje secret
      `SUPABASE_SERVICE_ROLE_KEY_DEV`, jinak se sada přeskočí.
- **Hotovo, když:** v produkci se lze přihlásit přes Google, admin pozve člena týmu a ten po přihlášení
  dostane správnou roli.

## Fáze D — Veřejný web čte z databáze (≈ 4 čd) → M3

- [ ] **D1** `lib/cache/tags.ts`; `features/{geography,indicators,portraits,entries,issues}/queries.ts`
      (anon klient, `unstable_cache` s tagy).
- [ ] **D2** Layout `(map)`: barvy vrstev a issues z DB; barevné mapy líně jen pro aktivní vrstvu (výkon).
- [ ] **D3** Stránky země, regionu, global issue, novinky/hesla, view, about, news index z DB;
      `generateStaticParams` z DB; `dynamicParams = true` pro redakční obsah.
- [ ] **D4** Fulltext přes RPC `search()` (`/api/search`, `/search`, `EncyclopediaPanel`); odebrat MiniSearch.
- [ ] **D5** Sitemap z DB (vč. global issues, `lastmod`, bez přesměrovaných URL), OG obrázky (`next/og`).
- [ ] **D6** Ověřit, že seed obsahuje vše, a **smazat `src/content/**`, `global-issues.json`, `lib/content.ts`
      fs čtení, `api/export-demo`** (SEC-10).
- [ ] **D7** Lighthouse CI s rozpočty (LCP < 2,5 s, JS < 200 kB, skóre ≥ 85).
- **Hotovo, když:** `src/content` neexistuje, smoke + e2e zelené, rozpočty splněné.

## Fáze E — Administrace ukládá do databáze (≈ 10 čd) → M4

- [ ] **E1** Admin shell: `app/admin/layout.tsx`, postranní menu z oprávnění, `DataTable` (TanStack),
      `FormField` + `useActionState`, `mapDbError`, potvrzovací dialog, toasty (**D7**).
- [ ] **E2** Hesla/novinky: seznam s filtry stavu, editor TipTap (allowlist rozšíření), upload obrázků do Storage
      (`{user_id}/{uuid}`), země, kategorie, autor; Server Actions `saveEntry`, `submitEntry`; revize s obnovou.
- [ ] **E3** Schvalování: fronta dle `can_approve_entry`, diff proti publikované verzi, schválit / vrátit
      s poznámkou / stáhnout.
- [ ] **E4** Portréty regionů a global issues: intro, metriky se zdrojem, timeline, FAQ, zdroje, vizuály
      (řazení drag & drop), výběr zemí na mapě pro issue.
- [ ] **E5** Data: ukazatele, ruční hodnoty s povinným zdrojem, palety, vzhled webu, mapové oblasti (GeoJSON).
- [ ] **E6** Účty: seznam, změna role, schvalovací přiřazení, blokace (+ ban v Auth API, DB-18), pozvánky (plná verze).
- [ ] **E7** Role a práva: matice role × sekce × `vced`, rozsahy, vlastní role, bezpečnostní nastavení, audit log.
- [ ] **E8** Odstranit staré admin formuláře a route handlery `api/admin/*` (**D6**, **D7**).
- [ ] **E10** Obrazovka MFA (TOTP) pro role z `require_2fa_roles` a pak vynucení `aal2` v `has_perm` (DB-07).
- [ ] **E9** Testy: každá Server Action integrační test „bez práva / s právem“; e2e hlavní toky
      (napsat → odeslat → schválit → je na webu; vrátit s poznámkou; pozvat → přihlásit → role).
- **Hotovo, když:** redakce provede celý tok od pozvánky po publikaci bez zásahu vývojáře; v kódu nezůstal
  žádný zápis do filesystému.

## Fáze F — Provozní připravenost (≈ 3 čd) → M5

- [ ] **F1** `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx` na všech datových stránkách.
- [ ] **F2** `/api/health` (DB + verze buildu), UptimeRobot, noční keep-alive workflow (Supabase Free se neuspí).
- [ ] **F3** Sentry (Free) se source mapami, filtrování PII; cookie-less analytika (Vercel Web Analytics).
- [ ] **F4** Noční zašifrovaná záloha DB (`pg_dump` + age), retence 14 dní, dokumentovaný test obnovy.
- [ ] **F5** Privacy policy, Terms, prohlášení o přístupnosti (SEC-11); souhlas newsletteru odkazuje na privacy.
- [ ] **F6** Feature flagy v DB (`feature_flags`) + režim údržby.
- [ ] **F7** Runbook incidentů v `docs/` (únik klíče, výpadek, zneužití účtu, obnova).
- [ ] **F8** Přístupnost: skip-link, `@axe-core/playwright` v CI, kontrast popisků nad satelitem, globus z klávesnice.
- **Hotovo, když:** checklist ARCHITEKTURA 16.2 a 16.4 je bez ⬜ v položkách označených pro M5.

## Fáze G — Rozšíření (po M5, samostatně plánovat)

- [ ] **G1** Vlastní SMTP (Resend) + ověřená doména; zapnout e-mailovou registraci čtenářů (feature flag),
      e-mailové pozvánky přes `inviteUserByEmail`, šablony e-mailů EN/CS, Turnstile. *(závisí na U5)*
- [ ] **G2** Náhled nepublikovaného obsahu (`draftMode`) + sdílitelný náhled s expirací; autosave editoru.
- [ ] **G3** Plánované publikování (`publish_at` + cron), správa přesměrování (`redirects`), kontrola mrtvých odkazů.
- [ ] **G4** Encyklopedická hesla P9 (`/entry/[slug]`, kapitoly, autor s positionality, audio R4).
- [ ] **G5** Jazykové mutace P15 (`[locale]`, `translations`, `messages/*.json`).
- [ ] **G6** Platby P10 (Stripe, webhook → `memberships`) — po přechodu na Vercel Pro (komerční použití).
- [ ] **G7** Webflow import P16 a přesměrování starých URL; přechod koncept → produkce (ARCHITEKTURA 13.5).

---

## Závislosti v kostce

```
0 ─▶ A ─▶ A2 ─┬─▶ D ─▶ E ─▶ F ─▶ G
              │         ▲
       B ─────┴─▶ C ────┘
   (B může běžet souběžně s A2; C potřebuje B3 + U1)
```

## Rizika plánu

| Riziko | Dopad | Opatření |
|---|---|---|
| Supabase Free se uspí / nemá zálohy | výpadek, ztráta dat | F2 keep-alive, F4 zálohy; před provozem Pro |
| Google OAuth consent screen vyžaduje ověření | přihlášení ukazuje varování | vyplnit consent screen s doménou a privacy policy (F5) |
| Změna dat během přechodu na DB (D6) | ztráta obsahu z `src/content` | před smazáním porovnat seed s DB testem `seed.test.mjs` |
| Vercel Hobby = nekomerční | porušení podmínek při spuštění plateb | G6 až po přechodu na Pro |
| Veřejné repo | únik interních informací | `docs/` mimo git, secret scanning + push protection, review PR |
