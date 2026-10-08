# Bezpečnostní standardy

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

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
| S8 | Hlavičky | CSP z `lib/security/csp.ts` (v produkci bez `unsafe-eval`; dynamické stránky se session nonce + `'strict-dynamic'`, statické/ISR `unsafe-inline` — ADR-025), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `frame-ancestors 'none'` | unit test CSP + smoke test hlaviček |
| S9 | Rate limiting | sdílené úložiště (tabulka `rate_limits` v Postgres nebo Upstash Free) — ne paměť procesu | integrační test |
| S10 | Tajné údaje | jen server; `server-only`; GitHub secret scanning + push protection; `grep` bundlu v CI | CI krok |
| S11 | Závislosti | Dependabot (týdně), `npm audit --audit-level=high` v CI, CodeQL (zdarma pro veřejné repo), zamčené verze | CI |
| S12 | Soubory | Storage RLS, cesta `{user_id}/…`, MIME allowlist bez SVG, limit velikosti | DB test Storage |
| S13 | Iframes | jen Flourish/World Bank/YouTube/Datawrapper, `sandbox` bez `allow-same-origin`, `loading="lazy"`, CSP `frame-src`. Datawrapper: z vloženého embed kódu server uloží jen ověřenou URL grafu (`lib/embeds.ts`, přesný host `datawrapper.dwcdn.net`, DB CHECK), iframe je náš; `allow-same-origin` výjimečně ano — graf načítá data ze svého originu, který nikdy není náš | unit + DB test |
| S14 | SSRF | server nikdy nestahuje URL zadanou uživatelem (výjimka: importní skript s allowlistem hostů) | code review |
| S15 | Chyby a logy | uživateli obecná hláška + ID; detail do logu; v logu žádné tokeny, hesla, celé e-maily | code review |
| S16 | Soukromí (GDPR) | privacy policy před newsletterem/platbami; minimalizace osobních údajů; retence audit logu 12 měsíců; `page_views_daily` jen agregovaně | checklist 13.5 |
| S17 | Admin | `noindex`, `force-dynamic`, žádné odkazy na admin z veřejných stránek, session timebox | smoke test |
| S18 | Obrazový optimizer | `images.remotePatterns` jen konkrétní hosty | smoke test (cizí host → 400) |

### 8.2 Content Security Policy (cíl)

```
default-src 'self';
script-src 'self' 'unsafe-inline' blob:;                           # statické/ISR stránky — ADR-025
script-src 'self' 'nonce-<nová>' 'strict-dynamic' 'sha256-<pre-paint>' blob:;  # admin, přihlášení, účet, pozvánka, checkout
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;      # Tailwind/MapLibre inline styly
img-src 'self' data: blob: https://*.supabase.co https://server.arcgisonline.com https://api.maptiler.com;
font-src 'self' https://fonts.gstatic.com data:;
connect-src 'self' https://<ref>.supabase.co wss://<ref>.supabase.co https://*.arcgisonline.com
            https://fonts.openmaptiles.org https://api.maptiler.com https://challenges.cloudflare.com;
frame-src https://flo.uri.sh https://public.flourish.studio https://*.worldbank.org
          https://www.youtube-nocookie.com https://datawrapper.dwcdn.net https://challenges.cloudflare.com;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

CSP skládá `buildCsp()` v `lib/security/csp.ts`; proxy ji posílá s každou odpovědí. Stránky renderované
na každý požadavek, které drží session (`NONCE_PATHS` v `proxy.ts`: `/admin`, `/auth`, `/login`, `/ucet`,
`/pozvanka`, `/membership/checkout`), dostanou při každém požadavku nový nonce: proxy ho pošle v hlavičce
odpovědi i v předané hlavičce požadavku, odkud ho Next dá na své skripty; jediný vlastní inline skript
(`PrePaintScript`) projde podle hashe (`lib/pre-paint.ts`, test hlídá shodu). Taková stránka musí být
dynamická (`force-dynamic`) — statická by nonce neměla a nespustila by se. Veřejné statické/ISR stránky
zůstávají na `unsafe-inline` (ADR-025). Nová externí služba = změna CSP v `lib/security/csp.ts` + test.

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
