# Testing and release reference

Incident basics, restore drill and workflow map for `atlas-testing-release`.

## Workflow map

| Workflow | File | When | What |
|---|---|---|---|
| [CI](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/ci.yml) | `ci.yml` | every PR, push to main | the two required checks |
| [Deploy to Vercel](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/deploy.yml) | `deploy.yml` | after green CI on main; PRs with `preview` label | migrations to production, then Vercel |
| [Full tests](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/full-tests.yml) | `full-tests.yml` | 01:30 UTC nightly, manual | Storybook, coverage, DB tests, jscpd, knip, audit, e2e (3 shards), Lighthouse |
| [Migrate atlas-dev](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/migrate-dev.yml) | `migrate-dev.yml` | push to main touching migrations, manual | applies missing migrations to atlas-dev |
| [Záloha DB](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/backup.yml) | `backup.yml` | 02:40 UTC nightly, manual | encrypted production dump, 14-day artifact |
| [Keep-alive](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/keepalive.yml) | `keepalive.yml` | 06:17 UTC daily | `/api/health` ping |
| [Kontrola odkazů](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/links.yml) | `links.yml` | Monday 05:41 UTC | dead links from the sitemap |
| Imports | `import-topics.yml`, `import-portraits.yml`, `backfill-resource-previews.yml` | manual, choose dev or prod | content imports; run against atlas-dev first |

Workflow and job display names partly stay Czech because required checks and history depend on them.

## Incident basics

1. **Confirm.** `/api/health` (status, db, version), the page itself, then
   [Vercel status](https://www.vercel-status.com/) and [Supabase status](https://status.supabase.com/).
2. **Classify.** Site down, wrong or stale content, broken feature, or security event.
3. **Stop the harm.**
   - Bad deploy: open a revert PR of the merge commit and let the pipeline ship it. If the site
     is unusable, the owner may use Vercel Instant Rollback in
     [deployments](https://vercel.com/atlas-of-today-s-world/atlas-of-todays-world/deployments) and
     then merge the revert so `main` matches production.
   - Content or data problem: put the public site in maintenance in
     [Admin → Switches & maintenance](https://atlas-of-todays-world.vercel.app/admin/switches)
     (`feature_flags.maintenance`, rendered by `MaintenanceGate`). The admin stays reachable.
   - Bad migration: fix forward with a new migration. Never edit the applied file.
   - Database paused (Supabase Free after inactivity): restore it from the
     [project page](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof); check why keep-alive failed.
   - Leaked secret or suspected breach: follow the key-leak runbook in `atlas-security`
     (reference). The GDPR 72-hour clock may apply.
4. **Look at the evidence.** [Vercel logs](https://vercel.com/atlas-of-today-s-world/atlas-of-todays-world/logs),
   Supabase [logs](https://supabase.com/dashboard/project/ewbzkxialhtwuqlenjof/logs/explorer),
   the failing workflow run, `audit_log` (Admin → Roles → audit).
5. **Verify the fix** with the post-deploy checks in SKILL.md.
6. **Write a blameless postmortem** when users saw downtime or wrong data, when data was lost, or
   when a rollback was needed: impact, timeline, root causes, what went well, action items. Keep it
   in the private `docs/` (gitignored); action items become tasks in `PLAN-REALIZACE.md`.

## Restore drill (quarterly)

Goal: prove that a nightly backup can rebuild the database, and measure how long it takes.
Use a throwaway Postgres 17 (local Docker or a temporary Supabase project). Never production,
never atlas-dev.

1. Download the latest `atlas-db-backup` artifact from a
   [Záloha DB](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/actions/workflows/backup.yml) run.
2. Decrypt with the owner's private key: `age -d -i <key file> atlas-db-<stamp>.tar.gz.age | tar xz`
   (gives `roles.sql`, `schema.sql`, `data.sql`). Keep the files on an encrypted disk and delete
   them afterwards.
3. Restore in one transaction:
   `psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql
   --command 'SET session_replication_role = replica' --file data.sql --dbname <throwaway URL>`.
4. Compare row counts of key tables (`entries`, `regions`, `profiles`, `site_pages`) with
   production (read-only query in the production SQL editor).
5. Note the backup age (how much data you would lose) and the time taken. Record the result in the
   private notes. Storage files are not in the dump: check that the buckets still hold the files
   the restored content references.

## Release hygiene

- Merge only with both required checks green and the PR template complete.
- Keep PRs small; a PR that needs a migration and a contract step is two PRs.
- After merging, watch the deploy run to the end and do the production checks.
- Dependabot PRs: read the changelog for minor bumps of `next`, `@supabase/*`, `maplibre-gl`;
  run the full tests on the branch when in doubt.
