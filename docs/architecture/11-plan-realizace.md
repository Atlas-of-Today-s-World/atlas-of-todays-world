# Plán realizace

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

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
