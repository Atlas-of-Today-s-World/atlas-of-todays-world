---
name: atlas-testing-release
title: Testing and release
description: How Atlas is tested and shipped - the test layers (unit, DB on PGlite, Playwright e2e, smoke, Storybook, Lighthouse), which command to run when, CI jobs and required checks, nightly full tests, PR previews, the migrate-dev and deploy flows, checking production after a deploy, commits, backups, uptime and incidents. Use when writing tests, opening or merging a PR, changing a workflow, deploying, or when production looks wrong.
roles: [release, frontend, backend]
---

# Testing and release

Atlas ships small PRs through one pipeline: **PR → required CI checks → squash merge to main →
`deploy.yml` (migrations first, then Vercel)**. Nobody deploys production by hand and nobody
force-pushes `main`. One task = one branch = one PR.

## Before you start

- GitHub Actions: [all workflows](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions).
  Production: https://atlas-of-todays-world.vercel.app.
- Supabase: [production](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof) and
  [atlas-dev](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh). Tests run against atlas-dev only.
- Related skills: `atlas-backend` (DB tests, migrations), `atlas-security` (workflow hardening),
  `atlas-performance` (Lighthouse budgets), `atlas-accessibility` (axe).
- Incident and restore steps: [reference](reference.md).

## Test layers

| Layer | Where | Command | Notes |
|---|---|---|---|
| Static | whole repo | `npm run typecheck`, `npm run lint`, `npm run format:check` | `typecheck` runs `next typegen` first; lint fails on any warning |
| Unit | `src/**/*.test.ts` next to the code, guards in `tests/unit/` | `npm test` | Vitest, Node env, `server-only` stubbed. Only `.test.ts` files are picked up |
| Coverage | `src/lib/security/**` | `npm run test:coverage` | 100 % statements, branches, functions, lines |
| DB | `supabase/tests/*.test.mjs` | `npm run test:db` | PGlite, no Docker; list new files in the script (`atlas-backend`) |
| E2E | `tests/*.spec.ts` | `npm run build`, then `npx playwright test [file]` | Desktop Chrome + Pixel 7; starts `npm run start`; account specs need the atlas-dev service key and skip otherwise |
| Accessibility | `tests/a11y.spec.ts` | part of e2e | axe, WCAG 2.1 A/AA, fails on serious or critical |
| Smoke | `scripts/smoke-test.mjs` | `BASE_URL=... npm run test:smoke` | No browser; fetches key pages; safe against production |
| Components | `*.stories.tsx` | `npm run storybook`, `npm run build-storybook` | Every shared component has a story |
| Performance | `lighthouserc.json` | nightly only | Budgets in `atlas-performance` |
| Links | `scripts/check-links.mjs` | `npm run check:links` | Weekly crawl of the live sitemap |

Guards in `tests/unit/` protect the architecture: `client-bundle` (no zod or @supabase/ssr in
client code), `migration-versions`, `cache-purge` (no cache refresh after a zero-row write),
`route-table`, `public-form-errors`, `sanitized-length`.

## What to run when

| You changed | Run before pushing |
|---|---|
| Anything | `npm run typecheck && npm run lint && npm test` |
| A migration, RLS, RPC or seed | `npm run test:db` |
| A page, layout, route or `next.config.ts` | `npm run verify 2>&1 \| tee build.log` (builds into `.next-build`, so `next dev` keeps running), then `node scripts/check-static-routes.mjs build.log`: public routes must not turn `ƒ` (dynamic) |
| A user flow, admin screen or form | build, then the matching `npx playwright test tests/<area>.spec.ts` |
| A shared component | its story in Storybook |
| Moved or deleted code | `npm run check:dup && npm run check:unused` (`atlas-dedup`) |
| `src/lib/security/**` | `npm run test:coverage` |

- **A bug fix starts with a test that reproduces it.**
- Server Action: unit test the validation and the result mapping (mock the Supabase client, as
  `src/features/auth/actions.test.ts` does) **and** a DB test for allowed / denied.
- Prefer role-based locators (`getByRole`) and web-first assertions in Playwright; no fixed waits.
- Never point e2e at production. `tests/support/accounts.ts` refuses the production ref.

## CI (`.github/workflows/ci.yml`)

Runs on every PR and push to `main`. Its two job names are the **required checks** on `main`.
Do not rename them ([branch rules](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/settings/branches)):

- **"Typy, lint, testy"**: typecheck → lint → format:check → test → check:audit.
- **"Build, smoke a e2e"**: build (log saved) → `scripts/check-static-routes.mjs` → start →
  `test:smoke`. Despite the name it runs no e2e. Uses atlas-dev public values.

[Full tests](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/full-tests.yml)
(`full-tests.yml`) run nightly at **01:30 UTC** and on demand: Storybook build, coverage, `test:db`,
jscpd, knip, audit, e2e in 3 shards against atlas-dev, and Lighthouse. They never block a deploy.
A red nightly run means "fix it before the next feature". Run it manually on your branch
(Run workflow) when a PR touches DB, auth or e2e-covered flows.

## PR rules

- Branch from `main`; one task per branch. Fill in the PR template (what and why, how tested,
  Definition of Done, **Security impact** for auth / RLS / migrations / proxy / `lib/security`).
- **PR title = commit message** (squash merge). Use English Conventional Commits:
  `feat(scope): ...`, `fix(scope): ...`, `refactor: ...`, `chore(deps): ...`, `content: ...`,
  `test: ...`, `docs: ...`. Imperative, lower case after the colon. Breaking: `feat!:`.
- Pre-commit (`.husky/pre-commit`) runs lint-staged: ESLint `--fix` + Prettier on staged
  `ts/tsx/mjs`, Prettier on `json/css/yml`. Do not bypass it with `--no-verify`.
- **Previews:** a PR gets a Vercel preview only with the
  [`preview` label](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/labels) (not from
  forks or Dependabot). **Previews read the production database** and run no migrations: never
  test writes there, and a preview cannot show a new migration.

## Migrations to atlas-dev

- [Migrate atlas-dev](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/migrate-dev.yml)
  (`migrate-dev.yml`) applies new migrations to atlas-dev on every push to `main` that touches
  `supabase/migrations/**`. The script refuses the production ref.
- When e2e or a teammate needs your migration before merge, run that workflow on your branch
  (Run workflow → your branch). From then on, the file is applied and must not change.
- Confirm in [atlas-dev migrations](https://supabase.com/dashboard/project/bognwszwhxxyjafqzfuh/database/migrations).

## Deploy (`.github/workflows/deploy.yml`)

1. Squash merge to `main` → CI runs on `main`.
2. CI green → [Deploy to Vercel](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/deploy.yml)
   starts (`workflow_run`). Job `migrate`: `supabase db push --include-seed` to production.
3. Job `deploy` (only if `migrate` succeeded): `vercel deploy --prod`; the build runs on Vercel
   ([deployments](https://vercel.com/atlas-of-today-s-world/atlas-of-todays-world/deployments)).
4. A failed migration stops the deploy and production keeps the old app. Check which migrations
   were applied in [production migrations](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/database/migrations)
   and fix forward with a new migration in a new PR.

Never run `vercel deploy --prod` or `supabase db push` against production yourself, and never push
straight to `main`.

## Check production after a deploy

Within a few minutes of the deploy run turning green:

1. `curl -s https://atlas-of-todays-world.vercel.app/api/health` → `"status":"ok"`, `"db":"ok"`
   and `"version"` equal to the first 7 characters of the merge commit SHA.
2. `curl -sI https://atlas-of-todays-world.vercel.app/topics | grep -i x-vercel-cache` → `HIT`
   (or `PRERENDER` on the first request). A steady `MISS` or no header on a public page means it
   went dynamic: treat it as a bug.
3. `BASE_URL=https://atlas-of-todays-world.vercel.app npm run test:smoke` → all checks pass.
4. Open the page you changed and, for admin changes, do one real save in the admin.
5. Watch [Vercel logs](https://vercel.com/atlas-of-today-s-world/atlas-of-todays-world/logs) and
   Supabase [logs](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/logs/explorer) for new errors.

**Owner rule: follow every deploy until the change is live, then tell the owner.** After any push
that ends in a production deploy, do not stop at "pushed": follow the CI run and the Deploy to
Vercel run (`gh run list --commit <sha>`, `gh run watch <id>`), then check the live site
https://atlas-of-todays-world.vercel.app (`/api/health` version = the commit, then the changed page
itself) until the change actually shows there. (The domain www.atlasoftodaysworld.org still serves
the old Webflow site; check it too once it points to this app.) As soon as it does, tell the owner it is live and
where to see it. If CI, the migration or the deploy fails, or the change does not show, tell the
owner straight away with what failed.

## Operations

- **Uptime:** [Keep-alive](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/keepalive.yml)
  calls `/api/health` daily at 06:17 UTC (it also keeps Supabase Free awake; a failure emails the
  owner). An external monitor (UptimeRobot, owner's account) watches `/api/health` and a public page.
- **Backups:** Supabase Free has no platform backups. [Záloha DB](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/backup.yml)
  (`backup.yml`, 02:40 UTC) dumps schema, roles and data, encrypts with `age` to the owner's key
  (variable `BACKUP_AGE_RECIPIENT`) and keeps the artifact 14 days. Storage files are not in the dump.
- **Restore drill** quarterly into a throwaway database, never production or atlas-dev: steps in
  [reference](reference.md).
- **Dead links:** [Kontrola odkazů](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/links.yml)
  every Monday 05:41 UTC.
- **Rollback:** revert the PR through a new PR (the normal pipeline). DB changes are never rolled
  back with "down" migrations; fix forward. Vercel Instant Rollback is the owner's emergency call.

## Checklist

- [ ] Right tests for the change (table above) pass locally; a bug fix has a reproducing test.
- [ ] New DB test file is listed in `test:db`.
- [ ] PR title is a Conventional Commit; template filled in, Security impact where needed.
- [ ] Both required checks green; migration applied to atlas-dev before e2e relies on it.
- [ ] After merge: deploy run green, `/api/health` shows the new version, `X-Vercel-Cache: HIT`, smoke passes.
- [ ] The change is visible on the live site and the owner has been told it is live.

## Anti-patterns

- Testing admin writes on a `preview` deployment: it writes to production data.
- Renaming a CI job: the required check disappears and merges stall (or pass unchecked).
- `--no-verify`, force-push to `main`, or a manual production deploy "just this once".
- Editing a migration after `migrate-dev` applied it: atlas-dev and production drift.
- Treating a red nightly run as noise: it is the only run of e2e, DB tests and Lighthouse.

## Sources

- Playwright: Best practices - https://playwright.dev/docs/best-practices
- Kent C. Dodds: The testing trophy - https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- Conventional Commits 1.0.0 - https://www.conventionalcommits.org/en/v1.0.0/
- Supabase: Database backups - https://supabase.com/docs/guides/platform/backups
- Google SRE: Postmortem culture - https://sre.google/sre-book/postmortem-culture/
- Trunk-based development - https://trunkbaseddevelopment.com/
