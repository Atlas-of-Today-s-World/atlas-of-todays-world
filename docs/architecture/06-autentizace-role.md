# Autentizace, role a oprávnění

> Část architektonické dokumentace Atlas of Today's World — přehled a mapa kapitol
> v [`ARCHITEKTURA.md`](../../ARCHITEKTURA.md). Čísla kapitol (§) se nemění: kód je
> cituje jako „ARCHITEKTURA x.y".

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
