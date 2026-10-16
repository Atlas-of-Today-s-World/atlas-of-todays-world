# Security and privacy reference

Longer detail for `atlas-security`. Names only; never write a secret value anywhere.

## Where configuration lives

| Kind | Place | Used by |
|---|---|---|
| GitHub secrets | [Actions secrets](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/settings/secrets/actions) | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (migrations, backup, migrate-dev), `VERCEL_TOKEN`, `RATE_LIMIT_SECRET`, `TURNSTILE_SECRET_KEY` (deploy), `SUPABASE_SERVICE_ROLE_KEY_DEV` (e2e and imports against atlas-dev) |
| GitHub variables | [Actions variables](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/settings/variables/actions) | `SUPABASE_PROJECT_REF`, `SUPABASE_DEV_PROJECT_REF`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SUPABASE_URL_DEV`, `NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV`, `SITE_URL`, `BACKUP_AGE_RECIPIENT` |
| Vercel project env | [Environment variables](https://vercel.com/atlas-of-today-s-world/atlas-of-todays-world/settings/environment-variables) | Supabase URL and keys for production, Mailchimp, IndexNow, search-console tokens |
| Local | `.env.local`, `.env.deploy.local` (gitignored) | Development against atlas-dev; owner tooling |
| Template | `.env.example` (committed, empty values) | Lists every variable the app reads |

Schema of server variables: `src/lib/env.server.ts` (Zod). Public ones: `src/lib/env.ts`.

## Key leak runbook (any token, key or password)

1. **Revoke or rotate** the key at its source right away:
   Supabase [API keys](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/settings/api-keys),
   Supabase [account tokens](https://supabase.com/dashboard/account/tokens),
   Vercel [tokens](https://vercel.com/account/settings/tokens),
   Cloudflare [Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile),
   Mailchimp API keys (Account → Extras → API keys).
2. **Swap it in** (GitHub secret or Vercel env) and redeploy through the normal pipeline
   (re-run the latest [Deploy to Vercel](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/deploy.yml) run from main).
3. **Verify** the site (`/api/health`, sign-in, a form) and only then delete the old key.
4. **Check logs** for use of the old key: Supabase [logs](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/logs/explorer), Vercel logs, `audit_log`.
5. **Assess the breach.** If personal data may have been exposed, the 72-hour GDPR notification
   clock starts when you become aware. Record every breach (facts, effects, remedy), even when
   no notification is needed.
6. If the leak was a commit: removing it from history does not un-leak it. Rotation is the fix.

Rotating `RATE_LIMIT_SECRET` simply starts fresh rate-limit windows. When rotating Supabase keys,
prefer the newer publishable / secret key types over the legacy anon / service_role JWT keys.

## Personal data map

| Data | Where | Why | Kept | Export | Delete |
|---|---|---|---|---|---|
| Account (email, name, role) | Supabase Auth, `profiles` | Sign-in, team work | While the account exists | yes | yes |
| Team assignments, invitations | `approver_*`, `invitations` | Permissions | Accepted invitations removed with the account | yes | yes |
| Volunteer applications | `volunteer_applications` | Recruiting writers | Until no longer needed, or on request (privacy page) | yes (by verified email) | yes |
| Newsletter address | Mailchimp | Newsletter | Until unsubscribe | Mailchimp | Mailchimp |
| Audit trail | `audit_log` | Accountability for privileged changes | 12 months (`purge_audit_log`) | own actions, column names only | pseudonymised, not deleted |
| Rate-limit windows | `rate_limits` (HMAC keys) | Abuse protection | 1 day | n/a | automatic |
| Preview links | `preview_links` (token hash only) | Sharing drafts | 7 days after expiry | n/a | automatic |
| Analytics | Vercel Analytics | Audience numbers | Vercel's retention | n/a (no personal data) | n/a |

When you add a row to this table in reality (a new table or a new processor), update the privacy
page, `my_personal_data()`, `delete_my_personal_data()` and `gdpr-completeness.test.mjs` in the same PR.

## CSP: adding a third-party service

1. Decide the directive: scripts (`script-src`), API calls (`connect-src`), iframes
   (`frame-src`, via `lib/embeds.ts` for content embeds), images (`img-src` already allows https),
   form posts (`form-action`).
2. Add the exact origin as a named constant in `lib/security/csp.ts` with a comment saying why.
3. Add or extend a case in `src/lib/security/csp.test.ts` (100 % coverage is required for
   `src/lib/security/**`).
4. Check both policies: a static page (`/topics`) and a nonce page (`/login`) in the browser console.
5. If it collects personal data, it is a processor: update the privacy page.

## Review prompts (OWASP Top 10 lens)

- Access control: can a reader, or a team member without the section right, reach the action
  or the row? Is there a denied test?
- Misconfiguration: new header, CSP origin, env var or workflow permission justified?
- Supply chain: new dependency or action pinned and justified?
- Injection: any string concatenated into SQL, HTML or a URL?
- Exceptional conditions: does any `catch` turn a failed permission or DB read into "allowed" or
  "empty"? (`must()` throws for this reason.)
- Logging: is the change auditable, and does any log line contain personal data?
