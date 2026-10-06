# Postupové standardy a další standardy

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

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
| ✅ | SEO: OG obrázky přes `next/og`, hreflang (jen en — ADR-022), index sitemap z DB s jazykovými verzemi a `lastmod`, strukturovaná data z `lib/seo/jsonld.ts`, RSS/Atom, `llms.txt`, IndexNow (ADR-021) |
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
