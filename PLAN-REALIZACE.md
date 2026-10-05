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
| U6 | UptimeRobot na `/api/health`; GitHub variable `SITE_URL` | F2 | ⬜ |
| U7 | Sentry účet + DSN | F3 | ⬜ |
| U8 | `age` klíč pro zálohy (`BACKUP_AGE_RECIPIENT`), soukromá část mimo GitHub | F4 | ⬜ |
| U9 | Nahrát `supabase/seed.sql` do produkční DB před nasazením fáze D; schválit ADR-014 | D | ⬜ |
| U10 | Export kolekcí z Webflow CMS (CSV „Export“ u každé kolekce, nebo API token pro Data API v2) | G7 | ⬜ |

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
- [x] **A10** Next 16 (updateTag v Server Actions, `proxy.ts`, ESLint flat config z `eslint-config-next`). TypeScript 7 zvlášť, až ho podpoří `typescript-eslint` a Next.
- [x] **A11** Kód podle pravidel React Compileru (`react-hooks/refs`, `set-state-in-effect`, `purity` — chyba; `useLatest`, `useHydrated` místo ref v renderu a setState v efektu); zapnutí React Compileru zvlášť.
- [x] **A9** MapLibre 6.11 (oprava GHSA-jrc7-96c5-q579): worker a sdílený modul se při `dev`/`build` kopírují do `public/maplibre/<verze>/` a globus je nastaví přes `setWorkerUrl` (ADR-017); výjimka v `audit-ci.jsonc` zrušena.
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
- [x] **A2.7** Storybook 10 (`@storybook/nextjs-vite`, `npm run storybook`) se stories pro `ui/*`, `atlas/*`, `portrait/*` a `admin/DataTable`; CI ověřuje, že se katalog sestaví.
- [x] **E2** Hesla/novinky: seznam s filtry stavu, editor TipTap (allowlist rozšíření), upload obrázků do Storage
      (`{user_id}/{uuid}`), země, kategorie, autor; Server Actions `saveEntry`, `submitEntry`; revize s obnovou. *(Autosave → G2.)*
- [x] **E3** Schvalování: fronta dle `can_approve_entry`, diff proti publikované verzi, schválit / vrátit
      s poznámkou / stáhnout.
- [x] **E4** Portréty regionů, zemí a global issues: intro, metriky se zdrojem, timeline, FAQ, zdroje, vizuály
      (řazení tlačítky nahoru/dolů — přístupné z klávesnice), země issue výběrem ze seznamu; sekce ukládá DB funkce
      `replace_portrait_items` v jedné transakci. *(Výběr zemí kliknutím na mapě — později.)*
- [x] **E5** Data: ukazatele (vlastní i importované), ruční hodnoty s povinným zdrojem, palety a číselníky, vzhled webu
      (sytost, hranice — promítá se do globusu), mapové oblasti (GeoJSON, nová vrstva na globusu).
- [x] **E6** Účty: seznam, změna role, schvalovací přiřazení, blokace (+ ban v Auth API, DB-18), pozvánky (plná verze
      vč. přiřazení schvalovatele). Oprava: ne-admin nedá roli se správou účtů/oprávnění ani ji nepřidá do matice (migrace 10 + testy).
- [x] **E7** Role a práva: matice role × sekce × `vced`, rozsahy, vlastní role, bezpečnostní nastavení, audit log.
      Sekce Členové: přehled + členství zdarma (jen admin).
- [x] **E8** Odstranit staré admin formuláře a route handlery `api/admin/*` (**D6**, **D7**). *(Hotovo ve fázi D.)*
- [x] **E10** Obrazovka MFA (TOTP) pro role z `require_2fa_roles` a vynucení `aal2` v `is_active/is_admin/has_perm/my_permissions`
      (DB-07, migrace 11 + test). ⚠ Po nasazení si admini a správci oprávnění při prvním vstupu nastaví TOTP.
- [~] **E9** Testy: e2e hlavní toky (napsat → odeslat → vrátit s poznámkou → znovu odeslat → schválit → je na webu;
      pozvat → přihlásit → role) + DB testy oprávnění (51). *Zbývá: integrační test každé Server Action zvlášť.*
- **Hotovo, když:** redakce provede celý tok od pozvánky po publikaci bez zásahu vývojáře; v kódu nezůstal
  žádný zápis do filesystému.

## Fáze F — Provozní připravenost (≈ 3 čd) → M5

- [x] **F1** `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx` na všech datových stránkách.
- [x] **F2** `/api/health` (DB + verze buildu), denní keep-alive workflow (`keepalive.yml`, proměnná `SITE_URL`).
      *UptimeRobot nastaví vlastník (U6).*
- [~] **F3** Cookie-less analytika (Vercel Web Analytics) hotová. *Sentry čeká na účet a DSN (U7).*
- [x] **F4** Noční zašifrovaná záloha DB (`backup.yml`: dump + age), retence 14 dní, postup a test obnovy v runbooku.
      *Vlastník: vytvořit age klíč a nastavit `BACKUP_AGE_RECIPIENT` (U8); první test obnovy.*
- [x] **F5** Privacy policy, Terms, prohlášení o přístupnosti (SEC-11); souhlas newsletteru odkazuje na privacy;
      newsletter jako Server Action s rate limitem v DB (D6). *Texty zkontroluje vlastník / právník; kontakt `NEXT_PUBLIC_CONTACT_EMAIL`.*
- [x] **F6** Feature flagy v DB (`feature_flags`) + režim údržby.
- [x] **F7** Runbook incidentů v `docs/` (únik klíče, výpadek, zneužití účtu, obnova).
- [x] **F8** Přístupnost: skip-link, `@axe-core/playwright` v e2e (10 typů stránek, 0 závažných nálezů), opravený `<dl>`
      u karet ukazatelů (jedna `StatItem`), viditelný fokus globusu. OG obrázky (`next/og`) pro zemi, region, issue, novinku.
- **Hotovo, když:** checklist ARCHITEKTURA 16.2 a 16.4 je bez ⬜ v položkách označených pro M5.

## Fáze G — Rozšíření (po M5, samostatně plánovat)

- [ ] **G1** Vlastní SMTP (Resend) + ověřená doména; zapnout e-mailovou registraci čtenářů (feature flag),
      e-mailové pozvánky přes `inviteUserByEmail`, šablony e-mailů EN/CS, Turnstile. *(závisí na U5)*
      *Kód připravený a vypnutý přepínačem `email_auth` (migrace 20261002000010): přihlášení šestimístným
      kódem na /login (EN/CS, rate limit, Turnstile jen s `NEXT_PUBLIC_TURNSTILE_SITE_KEY`), pozvánky e-mailem,
      šablony `supabase/templates/*`, Resend SMTP a captcha zakomentované v `config.toml`.
      **Po U5:** nastavit SMTP Resend a captcha v obou projektech (`supabase config push` nebo dashboard),
      `NEXT_PUBLIC_TURNSTILE_SITE_KEY` ve Vercelu, pak zapnout `email_auth` v administraci (Role a práva).*
- [x] **G2** Náhled nepublikovaného obsahu + sdílitelný náhled s expirací (`/preview/[token]`, ADR-016); autosave editoru do prohlížeče.
- [x] **G3** Plánované publikování (`publish_at` + pg_cron každých 5 min, `schedule_entry`/`unschedule_entry`, migrace 13),
      správa přesměrování (`redirects`, sekce news, uplatní se jen místo 404, migrace 14), týdenní kontrola odkazů
      (`links.yml`, `npm run check:links`). *Vlastník: ověřit pg_cron na dev projektu před nasazením.*
- [x] **G4** Encyklopedická hesla P9 (`/entry/[slug]`, kapitoly, autor s positionality, audio R4).
      *Hotovo: migrace 20261002000001–02, správa Autoři, editor kapitol a zdrojů, zvuk po kapitolách
      (bucket `entry-audio`: MP3, M4A/AAC, Ogg/Opus, WAV, FLAC do 50 MB — rozhodnutí vlastníka 2026-10-01;
      syntéza hlasu R4 až po výběru služby), plánovaná hesla šedivě na portrétu.*
      Navíc: stránka 404 s kvízem obrysů 50 států (jen EN, větev `feat/404-quiz`).
- [x] **G5** ~~Jazykové mutace P15~~ — **2026-10-05 zrušeno, web jen anglicky (ADR-022)**; původně: routy pod `[locale]` (angličtina bez předpony přes proxy, `/cs/…`), přepínač jazyka,
      hreflang/canonical a sitemap s jazykovými verzemi, `translations` + administrace Překlady (regiony, země, témata,
      ukazatele), `messages/{en,cs}.json` pro hlavičku a navigaci (ADR-018).
- [x] **G5.2** Zbylé texty UI do `messages/*.json` (sekce portrétu, panely, formuláře veřejné části) a české verze
      novinek/hesel (`entries.locale` + vazba na originál).
      *Hotovo: texty UI v #23, překlady hesel a novinek migrací 20261002000020 (`entries.locale` + `translation_of`).*
- [ ] **G6** Platby P10 (Stripe, webhook → `memberships`) — po přechodu na Vercel Pro (komerční použití).
- [ ] **G7** Webflow import P16 a přesměrování starých URL; přechod koncept → produkce (ARCHITEKTURA 13.5).
      *Připraveno: `scripts/import-webflow.mjs` (CSV z CMS Exportu i JSON z Data API v2, nanečisto bez `--apply`,
      zápis jen do projektu z `--project`, opakovatelný, obrázky z Webflow CDN do Storage, YouTube → zdroje),
      mapování `scripts/webflow/mapping.config.mjs` a 6 přesměrování starých stránek. Ověřeno na atlas-dev.
      **Vlastník (U10): dodat export kolekcí z Webflow CMS** — pak upravit názvy polí v konfiguraci a spustit
      nanečisto → `--apply --project dev` → kontrola → `--project prod`. Checklist 13.5 zůstává na vlastníkovi.*
- [x] **G8** SEO & GEO (ADR-021): robots s AI crawlery, index sitemap (`/sitemaps/*.xml`, `lastmod` z DB, hreflang,
      obrázky, Google News), RSS/Atom (EN/CS), `llms.txt` + `llms-full.txt` + Markdown verze článků, strukturovaná data
      z jednoho builderu (NGO, WebSite, NewsArticle/Article, Country se `sameAs` Wikidata, Dataset, ProfilePage, FAQ,
      breadcrumbs) ověřovaná v unit i e2e testech, metadata z `pageMetadata` (title ≤ 60, popis ≤ 160, OG/Twitter
      všude, `/cs` bez překladu kanonicky na originál), IndexNow po publikaci, veřejné profily autorů
      (migrace 20261002000080), O Atlasu s posláním, vydavatelem, redakčními zásadami a citací. PR: [#39](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/pull/39).
      *Vlastník: Search Console + Bing Webmaster + Seznam Webmaster, `INDEXNOW_KEY` ve Vercelu, Wikidata — viz `docs/seo-geo-audit.md`.*
- [ ] **G9** Témata (topics) na mapě a šablony dlaždic (ADR-023): počty témat nad zeměmi / regiony / skupinami
      (země dědí témata svého regionu a skupin, `entries.map_layers`), šablony „Learn more“ dlaždic
      (`topic_templates`, výchozí „Standard“ = pět původních sekcí, aplikace na existující téma, uložení tématu jako
      šablony), editor dlaždic (ikony, fotka nebo barva, pořadí) a barva dlaždic článků; přenos 17 témat ze starého
      webu (`scripts/webflow/scrape-global-issues.mjs` → `import-topics.mjs`, přesměrování starých adres).
      Na atlas-dev přes workflow „Topics on atlas-dev“ (s ukázkovým umístěním na mapě). **Na produkci zatím ne** —
      vlastník rozhodne o umístění témat na mapě a o importu do produkce (`--project prod` bez `--demo-places`).

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
