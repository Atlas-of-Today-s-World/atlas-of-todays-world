---
name: atlas-security
title: Security and privacy
description: Security and GDPR rules for Atlas - sign-in (getUser, invitations, 2FA), permissions, Server Actions as public endpoints, HTML sanitizing, safe URLs and redirects, the embed allowlist, CSP and headers, Turnstile, rate limits, secrets, GitHub Actions hardening, dependencies, uploads, logging, and personal data (minimisation, retention, export and deletion, cookie-less analytics, newsletter consent). Use when touching auth, roles, forms, HTML, URLs, embeds, headers, env vars, workflows, uploads or any personal data.
roles: [backend, frontend, release]
---

# Security and privacy

Atlas is a public repo with an invite-only editorial team and self-registered readers.
Every request is untrusted until the database says otherwise. **Defence in depth:** the app
checks for the user's sake, RLS decides for real (`atlas-architecture`, rule 1).

## Before you start

- DB-side rules (RLS, grants, definer functions, migrations): `atlas-backend`.
- Sensitive paths have a code owner (`.github/CODEOWNERS`): `supabase/`, `src/proxy.ts`,
  `src/lib/security/`, `src/lib/supabase/`, `.github/`. A PR touching them fills in the
  **Security impact** section of the PR template.
- **The repo is public.** State rules, never weaknesses. Findings and their status live only in the
  gitignored `docs/`; refer to them by ID. Report channel: `SECURITY.md`,
  `public/.well-known/security.txt`.
- Detail, secret inventory and the key-leak runbook: [reference](reference.md).

## Authentication

- On the server, identity is always `supabase.auth.getUser()` (`signedIn()` in `lib/actions.ts`,
  `currentUser()` in `lib/supabase/server.ts`). Never trust `getSession()` alone.
- Sign-in: Google OAuth (`features/auth/oauth-actions.ts`) and an emailed code
  (`features/auth/email-actions.ts`). No passwords. The email code is 8 digits and expires after
  3600 s (`supabase/config.toml`); this is an owner decision, keep it.
- Every `next` / return URL goes through `safeRedirect(value, fallback)`
  (`lib/security/redirect.ts`); sign-in ends in `finishSignIn` / `signInDestination`.
- Readers self-register as `reader` with no admin access. The team joins only by invitation:
  `invitations` + `claim_invitation()`, which accepts only a **verified** email equal to the
  invitation. The link carries no secret.
- **2FA** is required for the `admin` and `permission-admin` roles only
  (`security_settings.require_2fa_roles`; `has_perm` then demands `aal2`). The admin layout shows
  `MfaGate` (`features/auth/mfa.ts`). Do not extend it to other roles without the owner.
- Authorize from DB tables (`my_permissions()`, `has_perm()`), never from `user_metadata`.
- Session cookies: `SESSION_COOKIE_OPTIONS` (`lib/supabase/config.ts`): httpOnly, SameSite=Lax,
  Secure on Vercel. The proxy refreshes the session only on `SESSION_PATHS`.

## Permissions

- Model: role × section × action (`v`/`c`/`e`/`d`). Sections: `src/config/sections.ts`.
  App helpers: `getAccess()`, `can()`, `isStaff()`, `sectionAccess()` (`features/auth/access.ts`).
- A new section = DB `CHECK` + `my_permissions()` + `config/sections.ts` +
  `features/roles/labels.ts` + DB tests (`atlas-backend`).
- Admin pages: `const access = await sectionAccess("x"); if (!access) return <NoAccess />;`.
  No access is a 200 page, never `forbidden()` (`atlas-architecture`).
- Anyone invited into the team may edit content. Do not add editorial approval gates.

## Server Actions and route handlers are public endpoints

- Anyone can POST to any action, whatever page it sits on. **Each action authenticates**
  (`formAction` / `idAction` / `signedIn()`) **and is authorized by RLS** through the session
  client; `affected()` turns a refused write into a message. A page or layout check protects nothing.
- Validate every argument with Zod, including hidden fields, bound ids and `params`.
- Return minimal data. Never close over secrets in an inline `"use server"` function.
- The service client runs only after the action proved permission with an RLS-checked write, or
  in a deliberately public endpoint with rate limit and captcha.
- `route.ts` handlers: GET never changes state. A state-changing POST rejects a foreign `Origin`
  (see `app/auth/signout/route.ts`).
- `src/proxy.ts` does optimistic checks only (redirect to `/login`, 401 JSON for `/api/admin`).
  It is never the only gate.

## Untrusted HTML and URLs

- Rich text passes **one allowlist**: `sanitizeRichHtml` (`lib/security/sanitize.ts`) at save
  (inside the Zod schema) and again at render via `<SafeHtml>` (`components/atlas/SafeHtml.tsx`).
  Map popups use `sanitizePopupHtml`. JSON-LD goes through `<JsonLd>` (`jsonLdHtml` escaping).
- `dangerouslySetInnerHTML` exists only in `SafeHtml`, `JsonLd` and `PrePaintScript` (ESLint).
  Do not widen the allowlist without a test in `sanitize.test.ts`.
- Any URL from data into `href`, `src` or `style` goes through `safeUrl()` / `cssBackgroundImage()`
  (`lib/security/urls.ts`). Forms validate with `httpsUrl` / `optionalHttpsUrl`
  (`lib/validation/common.ts`); the DB adds `^https://` checks.
- Photos load only from trusted origins (`isTrustedPhoto`, `PHOTO_ORIGINS` in `lib/images.ts`, which `next.config.ts` uses).
- Server-side fetches of an editor-typed URL follow `lib/previews/preview-image.ts`: https only,
  public IPs only, pinned address, at most 3 redirects, 5 s, 512 kB. Never fetch a user URL ad hoc.

## Embeds, CSP and headers

- **Embeds:** one allowlist in `lib/embeds.ts` (Datawrapper, Flourish, Our World in Data, World
  Bank) drives Zod, the DB `CHECK` and CSP `frame-src`. Only the canonical URL is stored, never
  pasted HTML. `components/visuals/EmbedFrame` is the only iframe (sandboxed, lazy, height messages
  only from the provider origin). A new provider = `lib/embeds.ts` + a migration for the `CHECK` +
  `csp.test.ts`.
- **CSP** is built in `lib/security/csp.ts` and set by `src/proxy.ts`. There are two policies (ADR-025):
  - Session pages (`NONCE_PATHS`: admin, /auth, login, account, invite, checkout) get a fresh
    nonce per request: `'nonce-...' 'strict-dynamic'` plus the hash of `PrePaintScript`. Every
    page under `NONCE_PATHS` must render dynamically, or its scripts will not run.
  - Static and ISR public pages share one policy with `'unsafe-inline'`, because a nonce would
    make every page dynamic. XSS there is prevented by sanitizing and the ESLint ban, and
    `script-src-attr 'none'` blocks inline event handlers.
  - Never add `'unsafe-eval'` outside development. Never add a public page to `NONCE_PATHS`.
  - A new third-party origin = add it to the right directive in `csp.ts` + a case in
    `csp.test.ts`. No wildcards in `script-src` or `frame-src`.
- **Headers** (`securityHeaderEntries`): nosniff, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY` + `frame-ancestors 'none'`, a restrictive `Permissions-Policy`,
  COOP `same-origin`, HSTS 2 years in production. After a header change, check the site on
  [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=atlas-of-todays-world.vercel.app) (target A or better).
- `NOINDEX_PATHS` in the proxy send `X-Robots-Tag: noindex, nofollow`.

## Abuse protection

- Every public endpoint that writes or sends email has a rate limit (`allowRequest` /
  `allowEmail`, `atlas-backend`): today email code, email verify, newsletter, volunteer, search.
- Public forms (newsletter, volunteer) also pass Cloudflare Turnstile: widget
  `components/ui/turnstile.tsx`, server check `passesCaptcha(formData, headers)`
  (`lib/security/turnstile.ts`) after Zod, plus a hidden honeypot field (`website`). Email
  sign-in hands the token to Supabase Auth as `captchaToken`, which verifies it.
- `captchaEnabled()` is read at build time, so both Turnstile keys are set in `deploy.yml` as
  build env and runtime env.

## Secrets and configuration

- Secrets live only in GitHub
  [Secrets](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/settings/secrets/actions) /
  [Variables](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/settings/variables/actions)
  and in gitignored `.env*.local`. `deploy.yml` passes runtime secrets with `--env` and public
  values with `--build-env`.
- A new secret: add it to the Zod schema in `lib/env.server.ts`, an empty line in `.env.example`,
  the GitHub secret, and the `deploy.yml` args. Read it only through `serverEnv` in a
  `server-only` module.
- **Never** prefix a secret with `NEXT_PUBLIC_`, print one in logs or tool output, or commit one.
- Tests, previews of migrations and experiments use atlas-dev credentials only.

## GitHub Actions

- Top-level `permissions: contents: read`; widen per job only if needed.
- `actions/checkout` with `persist-credentials: false`.
- Third-party actions that run next to production credentials are pinned to a full commit SHA
  (`supabase/setup-cli@45a5...`); CLIs are installed at exact versions (`vercel@62.5.0`, Supabase
  CLI `2.120.0`).
- Secrets go in the `env:` of the one step that needs them, not the job.
- Never interpolate `${{ github.event.* }}` text (titles, branch names) inside `run:`; pass it
  through `env:`. No `pull_request_target`.
- `workflow_run` and dispatch jobs check event, repository and branch explicitly (copy the `if:`
  of `deploy.yml`). Fork and Dependabot PRs never get secrets.
- Artifacts that may hold sessions (Playwright reports) keep `retention-days: 1`; traces stay off in CI.

## Dependencies

- Dependabot (`.github/dependabot.yml`) opens grouped PRs every Monday. Majors of `next`,
  `eslint-config-next`, `maplibre-gl`, `typescript` and `eslint` are planned migrations, not bumps.
- `npm run check:audit` (`audit-ci.jsonc`: high and above in production dependencies) blocks CI.
  An allowlist entry needs a reason and an expiry plan.
- Keep [code scanning](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/security/code-scanning)
  (CodeQL default setup), [secret scanning with push protection](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/settings/security_analysis)
  and [Dependabot alerts](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/security/dependabot) on.
- A new dependency is justified in the PR (size, maintenance, licence).

## Uploads

- Allowed kinds live in `lib/upload-rules.ts`: images JPEG/PNG/WebP/AVIF up to 3 MB, audio up to
  50 MB. **No SVG.** The bucket enforces type and size again.
- `prepareUpload` (`features/uploads/actions.ts`) signs a one-object upload to
  `{bucket}/{user_id}/{uuid}.{ext}` under the session; Storage policies check the right.
  The browser never gets the session; names are server-generated.

## Logging

- Server logs use a `[scope]` prefix (`console.error("[db]", ...)`). Log the code and the message,
  never tokens, OTP codes, keys, passwords or full email addresses.
- `mapDbError` logs unknown DB errors and returns a safe sentence; never send SQL or stack traces
  to the client.
- Privileged changes are audited in the DB by `audit_row()` triggers into `audit_log` (viewed at
  Admin → Roles → audit). Audit rows hold ids, not personal text, and are kept 12 months.

## Personal data (GDPR)

- **Minimise.** Collect only what a feature needs. No IP addresses or user agents in tables (rate
  limits store HMACs). Card data never touches Atlas (Stripe hosts it).
- **Retention:** state it on the privacy page (Admin → Site pages → Privacy) and enforce it in
  `db_housekeeping()`. A new kind of personal data needs a retention period in both places.
- **Export and deletion are self-service:** `GET /api/account/export` (`apiRoutes.accountExport`,
  RPC `my_personal_data()`) and `deleteAccount` (`features/auth/actions.ts`, RPC
  `delete_my_personal_data()`), on `/account` for readers and `/admin/account` for the team.
  **A new table with personal data must be added to both and to
  `supabase/tests/gdpr-completeness.test.mjs`.** Export keys are only added, never renamed.
- **Analytics are cookie-less** (Vercel Analytics in `src/app/layout.tsx`). Adding any tracker
  that sets cookies or fingerprints needs owner approval and a consent mechanism first.
- **Newsletter:** explicit consent checkbox + double opt-in (`status: "pending"` in
  `features/newsletter/actions.ts`), Mailchimp holds the list.
- **Processors** (Supabase, Vercel, Mailchimp, Cloudflare, Google sign-in...) are listed on the
  privacy page. A new processor updates that list in the same PR (a guarded content migration).
- Requests by email (no account) are answered within 30 days, as the privacy page promises.

## Checklist

- [ ] Every new action: Zod + `signedIn` wrapper + session client + `affected`.
- [ ] No new `dangerouslySetInnerHTML`, raw `href={data.url}` or unchecked redirect.
- [ ] New external origin: `csp.ts` + `csp.test.ts`; embed provider also in `lib/embeds.ts` + DB `CHECK`.
- [ ] Public write or email endpoint: rate limit + Turnstile + honeypot.
- [ ] New secret: `env.server.ts`, `.env.example`, GitHub secret, `deploy.yml`; no `NEXT_PUBLIC_`.
- [ ] Workflow change: minimal permissions, pinned actions near secrets, step-level secrets.
- [ ] Personal data: retention, export, deletion, privacy page and GDPR test updated.
- [ ] PR "Security impact" filled in for code-owned paths.

## Anti-patterns

- Hiding a button instead of denying in RLS: the action is still callable.
- `forbidden()` / `authInterrupts` for no-access pages: makes every page dynamic.
- A nonce on public pages "for safety": ends static rendering for the whole site.
- `frame-src https:` or a wildcard to make one embed work: use the allowlist.
- Logging a whole request, user or error object that may contain tokens or emails.

## Sources

- Next.js: Data security - https://nextjs.org/docs/app/guides/data-security
- Next.js: Content Security Policy - https://nextjs.org/docs/app/guides/content-security-policy
- OWASP Top 10 - https://owasp.org/Top10/
- OWASP Cheat Sheets: XSS, SSRF, File upload, Logging, Secrets - https://cheatsheetseries.owasp.org/
- Supabase: Auth rate limits - https://supabase.com/docs/guides/auth/rate-limits
- Supabase: API keys - https://supabase.com/docs/guides/api/api-keys
- GitHub: Security hardening for Actions - https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- MDN HTTP Observatory scoring - https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring
- ICO: Data protection principles - https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/
- GDPR Art. 12 and 33 - https://gdpr-info.eu/art-12-gdpr/ , https://gdpr-info.eu/art-33-gdpr/
- CNIL: Analytics exemption - https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications
