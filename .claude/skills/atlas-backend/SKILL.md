---
name: atlas-backend
title: Backend
description: How Atlas talks to Supabase - the three clients, public queries vs editorial reads, must/rowsOf, the Server Action pattern (formAction, idAction, affected, updateTag), RPCs for content state, migrations (naming, expand-only, grants, RLS per command, FK indexes, CHECK limits), DB tests on PGlite, type generation, rate limits and webhooks. Use when adding a table, column, policy, RPC, migration, Server Action or query, or when a DB test fails.
roles: [backend]
---

# Backend

Postgres in Supabase holds the data **and** the rules. The app reads through RLS, writes
through Server Actions under the user's session, and changes content state only through RPCs.
If the database would refuse it, the app must not try to allow it.

## Before you start

- Read `atlas-architecture` (layers, caching, the 10 rules). Security rules: `atlas-security`.
- Projects: production [ewbzkxialhtwuqlenjof](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof)
  and `atlas-dev` [bognwszwhxxyjafqzfuh](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh).
  **Tests and experiments go to atlas-dev, never production.**
- Commands: `npm run test:db` (PGlite, no Docker), `npm test`, `npm run db:types`,
  `npm run db:make-admin -- <email>`.
- Migration template and DB-test template: [reference](reference.md).

## Supabase clients (`src/lib/supabase/`)

| Client | File | Use for |
|---|---|---|
| `createPublicClient()` | `public.ts` | Public reads in `queries.ts`. Anon key, no session, `server-only`. |
| `createServerClient()` | `server.ts` | Admin reads (`editorial.ts`) and every user write. Session cookies, RLS applies. |
| `createServiceClient()` | `service.ts` | Narrow server tasks only (Auth admin API, rate limits, public forms). Bypasses RLS. |
| `createAnonBrowserClient()` | `browser.ts` | Client code that needs anon access without a session. |

- `@supabase/supabase-js` is imported only inside `src/lib/supabase/**` (ESLint).
- Env: `publicEnv` (`lib/env.ts`), `serverEnv` (`lib/env.server.ts`, Zod-parsed, `server-only`).
- Use the service client only after the same action has proved permission with an RLS-checked
  write (see `features/accounts/actions.ts`: profile update under RLS, then the Auth ban), or for a
  deliberately public, rate-limited endpoint (`features/volunteers/actions.ts`).

## Reads

- Public: `features/x/queries.ts`, `createPublicClient()` inside `unstable_cache` with `tags.*`
  (`atlas-architecture` has the caching rules). Admin: `features/x/editorial.ts`, session client,
  no cache.
- Name the columns. **Never `select *` through the anon client**: anon has column grants, and
  internal columns (`owner_id`, `review_note`, `approved_by`...) are not granted.
- Unwrap results with `must(result, "scope")` or `rowsOf(result, "scope")` (`lib/db/result.ts`).
  A failed read throws `[scope] message`, so the error boundary shows it. A DB error must never
  turn into an empty list or a 404.
- PostgREST returns at most 1000 rows (`max_rows` in `supabase/config.toml`). Lists that can grow
  past that must page with `.range()`. The only pager today is the local `all()` in
  `features/geography/queries.ts`; when a second feature needs it, move it to `lib/db/`.
- Admin search across columns: `ilikeAny()` (`lib/db/filters.ts`), never a hand-built `.or()`.

## Server Actions

Every mutation is a Server Action in `features/<domain>/actions.ts` (or `*-actions.ts`), with
`"use server"` and `import "server-only"`. The fixed steps live in `lib/actions.ts`:

1. **Validate** with Zod (`formAction(schema, handler, { arrays })` or `idAction` for one uuid).
   HTML fields sanitize inside the schema (`.transform(sanitizeRichHtml)`), then re-check the
   length (`htmlTooLong`), because sanitizing can grow the text.
2. **Authenticate**: the wrappers call `signedIn()` (`getUser()`); signed out = `NOT_SIGNED_IN`.
3. **Write under RLS** with the session client and end the write with `.select("id")`.
4. **Check the result** with `affected(result, "You can't ...")`: zero rows means RLS refused.
   DB errors become `failed(error)` → `mapDbError` (`lib/db/errors.ts`).
5. **Refresh**: `updateTag(tags.x)` for public pages and `revalidatePath(adminRoutes.x...)` for
   admin screens. Only after a real write (`tests/unit/cache-purge.test.ts` guards this).
6. **Return** an `ActionState` (`lib/action-state.ts`): `{ ok, message }` or `{ ok: false, error,
   fieldErrors }`. Return only what the UI needs, never raw rows.

```ts
export const saveSiteSettings = formAction(SettingsInput, async ({ data, supabase }) => {
  const denied = affected(
    await supabase.from("site_settings").update(data).eq("id", 1).select("id"),
    "You can't change the site settings.",
  );
  if (denied) return denied;
  updateTag(tags.site);
  revalidatePath(adminRoutes.siteSettings, "layout");
  return { ok: true, message: "Saved." };
});
```

- Row buttons bind the id: `deleteX.bind(null, row.id)`. Forms use `useServerAction` / `ActionForm`
  (`components/ui/action-form.tsx`, see `atlas-admin`).
- Trigger and RPC errors meant for people: `raise exception 'Human sentence.' using errcode =
  '42501'` (or 22023, 23505, 23503). `mapDbError` shows such sentences as written and hides the rest.
- Do not use `revalidateTag`; `updateTag` gives read-your-own-writes in actions.

## Content state goes through RPCs

- Entry state (planned → draft → pending → published) changes only via RPCs called from
  `features/entries/workflow-actions.ts`: `submit_entry`, `withdraw_entry`,
  `approve_entry(p_entry, p_expected_updated_at)`, `unpublish_entry`, `send_back_entry`,
  `schedule_entry`, `unschedule_entry`, `create_preview_link`. Never `update entries set status`.
- `approve_entry` takes the `updated_at` the approver saw, so a stale approval is refused.
- After approve or unpublish: `refreshEntry(...)` (`features/entries/revalidate.ts`) refreshes the
  page tags and pings IndexNow.
- A new RPC: SECURITY DEFINER only when needed, permission check as its first statement,
  `set search_path = public, pg_temp`, `revoke execute ... from public, anon`, then an explicit
  `grant execute ... to <role>`. Add it to `APP_RPCS` in
  `supabase/tests/search-helpers-hardening.test.mjs`, or `test:db` fails.
- Scheduled work runs in the DB via pg_cron (ADR-015): `publish_due_entries()` every 5 min,
  `db_housekeeping()` daily. Not Vercel Cron.

## Migrations (`supabase/migrations/`)

- **New file only. Never edit a migration that has been applied anywhere** (atlas-dev counts).
  Fix forward with a new file.
- Name: `YYYYMMDDNNNNNN_snake_name.sql` - date + 6-digit sequence, usually steps of 10
  (`20261015000100_visuals.sql`). Versions must be unique and increasing;
  `tests/unit/migration-versions.test.ts` fails on a duplicate. With parallel sessions, agree on
  the number first.
- **Expand-only.** `deploy.yml` runs migrations **before** the new app is live, so the old code
  must still work: add nullable columns or defaults, new functions next to old ones. Drop the old
  thing in a later "contract" PR. State the phase in the file header and the PR.
- Start the file with a comment: what, why, which test covers it.
- **Grants are explicit.** Default privileges are revoked (20261013000210): a new table, sequence
  or function gives `anon`/`authenticated` nothing. Grant columns to anon only for public data.
  A function used in a policy, CHECK, index or generated column needs `EXECUTE` for the role that
  reads or writes; helper functions called only by a definer RPC get no grant.
- **RLS:** `enable row level security` on every table. One policy per command (`select`,
  `insert`, `update`, `delete`), never `for all`, each with `to anon` or `to authenticated`.
- **Wrap constant-argument helpers in a sub-select** so they run once per statement:
  `(select auth.uid())`, `(select public.has_perm('users','v'))`. Helpers that take a row value
  (`can_edit_visual(region_slug, ...)`) stay bare.
- Every foreign key gets an index. Every table gets `updated_at` + the `stamp_row` trigger.
- `CHECK` constraints for lengths, enums and `^https://` URLs, with the **same limits as Zod**
  (`supabase/tests/check-limits.test.mjs`).
- Every function: `set search_path = public, pg_temp`.
- **Guard triggers that read RLS-protected tables must be SECURITY DEFINER**, or the check is
  silently skipped. Guards are bypassed only by the service role or by a definer function via
  `internal_profile_grants` (one transaction). Never via `set_config` or JWT flags.
- Content edits in migrations (e.g. the privacy page) must be re-runnable and must not overwrite
  editors' later changes: guard the `update` with `where ... like` on the old text.
- After the PR merges, `migrate-dev.yml` applies it to atlas-dev. To rely on it before merge, run
  [Migrate atlas-dev](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/migrate-dev.yml)
  on your branch; after that, the file is frozen.
- After it lands on atlas-dev, check the
  [Security](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/advisors/security) and
  [Performance](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/advisors/performance)
  advisors and fix new findings.

## DB tests (`supabase/tests/`)

- `npm run test:db` runs `node --test` with PGlite: all migrations + `supabase-stubs.sql`.
  **A new test file must be added to the `test:db` script in `package.json`**, or it never runs.
- Every permission change gets allowed **and** denied cases: anon, a role with the right, a role
  without it. RLS and default roles: `rls.test.mjs`; column grants: `column-grants.test.mjs`; the
  section matrix: `site-section.test.mjs`. Copy the `as(user, fn, { aal })` / `asService(fn)`
  helpers from the nearest test file.
- The authorization matrix is covered by the "permission matrix" tests in `rls.test.mjs` and the
  e2e specs `tests/admin-permissions.spec.ts` and `tests/permission-matrix.spec.ts`.
- PGlite has no pg_cron: call the scheduled function directly in the test.
- Some unit tests read migration SQL to keep TS constants in sync (`src/lib/content-types.test.ts`,
  `src/lib/db/errors.test.ts`). If one fails, align both sides.

## Types

- After the migration is on atlas-dev: `npm run db:types` (needs `SUPABASE_DEV_PROJECT_REF` and a
  Supabase login). Commit `src/lib/db/types.gen.ts`; never edit it by hand.

## Rate limits (`lib/security/rate-limit.ts`)

- Shared table `rate_limits`, written through the service client: `allowRequest(scope, headers,
  { limit, windowSeconds })`, `allowEmail(scope, email, limits)`, `allowKey(key, limits)`.
- `allowRequest` and `allowEmail` store an HMAC (`RATE_LIMIT_SECRET`), never the raw IP or email.
  A key passed to `allowKey` must hold no personal data; hash it first. Client IP: `clientIp` /
  `rateLimitAddress` (`lib/security/ip.ts`). Old windows are deleted daily by `db_housekeeping()`.
- Which endpoints need a limit: `atlas-security`.

## Webhooks and payments

- Stripe (ADR G6) is on only when `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are both set
  (`stripeEnabled()` in `lib/stripe.ts`); otherwise "Donate & Join" stays on the demo checkout.
  Local work and tests use test keys (`sk_test_`) only; live keys live only in GitHub secrets.
- Checkout: `startCheckout` → `createCheckoutUrl` (`features/membership/stripe.ts`), hosted page,
  monthly subscriptions only, marked `metadata.atlas = "patron"` (one-time donations were removed 2026-10-19).
- Webhook: `app/api/stripe/webhook/route.ts` reads the raw body, verifies the signature, stores
  `event.id` (`stripe_event_seen`, forgotten on failure so the retry runs), re-fetches the
  subscription and writes through `apply_stripe_subscription()` (service role). Membership state
  comes only from webhook-confirmed events, never from the success redirect.
- Donors without an account wait in `pending_memberships` (server-only) until they sign in with
  that confirmed e-mail: `claim_my_donations()` runs in `signInDestination`.
- Events to subscribe in Stripe: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Checklist

- [ ] Migration: new file, unique version, expand-only, header comment, explicit grants.
- [ ] RLS on, one policy per command with `to <role>`, helpers wrapped in `(select ...)`.
- [ ] FK indexes, `CHECK` limits equal to Zod, `search_path` set, definer only when needed.
- [ ] DB test with allowed and denied cases, listed in `test:db`; new RPC in `APP_RPCS`.
- [ ] Action: `formAction`/`idAction`, `.select("id")` + `affected`, `updateTag` only after a write.
- [ ] `types.gen.ts` regenerated; migration applied to atlas-dev before e2e relies on it.

## Anti-patterns

- `select *` through the anon client: leaks internal columns or fails on column grants.
- Checking `error` only: an RLS-filtered update returns no error and zero rows.
- A direct `update` of `status`: skips the workflow rules in the RPC.
- Editing an applied migration: atlas-dev and production drift from the repo.
- Dropping or renaming a column in the same PR as the code change: the live app breaks for the
  minutes between migration and deploy.

## Sources

- Supabase: Row Level Security - https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase: Database advisors - https://supabase.com/docs/guides/database/database-advisors
- Supabase: Managing environments - https://supabase.com/docs/guides/deployment/managing-environments
- PostgreSQL: CREATE FUNCTION (search_path, SECURITY DEFINER) - https://www.postgresql.org/docs/current/sql-createfunction.html
- PostgreSQL: Constraints (FK indexes) - https://www.postgresql.org/docs/current/ddl-constraints.html
- Martin Fowler: Parallel Change - https://martinfowler.com/bliki/ParallelChange.html
- Stripe: Webhooks - https://docs.stripe.com/webhooks
