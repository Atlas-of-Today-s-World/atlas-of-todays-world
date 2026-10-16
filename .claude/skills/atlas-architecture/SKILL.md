---
name: atlas-architecture
title: Architecture
description: The binding architecture of Atlas of Today's World (Next.js 16, React 19, Supabase, Vercel) - stack, folder layers, the feature file pattern, ESLint layer rules, data flow, caching and static/ISR rules, ADRs and the 10 non-negotiable rules. Use it before any change to code, the database (migrations, RLS, functions), sign-in and permissions, the admin, tests or CI, and when reviewing a PR.
roles: [frontend, backend, release]
---

# Architecture

How the Atlas code is put together and the rules every change keeps. The one principle:
**the database decides, the app displays.** Permissions live in Postgres (RLS and
SECURITY DEFINER functions); checks in the UI are only for the user experience.

## Before you start

- **This is not the Next.js you know.** Next 16 changed APIs and conventions. Read the relevant
  guide in `node_modules/next/dist/docs/` before you write code (see `AGENTS.md`).
- Architecture docs (Czech) live in `docs/architecture/`. The index is `ARCHITEKTURA.md`.
  The current state and technical debt are in `docs/architecture/analyza-2026-10.md`. Recipes
  (new table, new admin screen, new public page) are in `docs/architecture/12-postupy-a-standardy.md`.
- Related skills: `atlas-backend` (Supabase, actions, migrations), `atlas-security`,
  `atlas-dedup`, `atlas-frontend`, `atlas-performance`, `atlas-admin`, `atlas-testing-release`.

## Stack

- Next.js ^16.4 App Router, React ^19.2 (React Compiler lint rules on), TypeScript ^5.9 strict, ESM.
- Tailwind ^4.1 (`@tailwindcss/postcss`, tokens in `src/app/globals.css` `@theme`), cva + clsx +
  tailwind-merge (`src/lib/cn.ts`), lucide-react icons.
- Supabase: Postgres 17 in Frankfurt, `@supabase/ssr` + `supabase-js`, RLS on every table,
  pg_cron for scheduled publishing and housekeeping.
- MapLibre GL ^6 (globe in the `(map)` layout, never remounted), TipTap editor, Zod ^4, sanitize-html.
- Vercel (Hobby, region `fra1` in `vercel.json`), deployed only from GitHub Actions.
  Public GitHub repo `Atlas-of-Today-s-World/atlas-of-todays-world`.
- Node 22 (`.nvmrc`). English only: `src/messages/en.json`, `LOCALES = ["en"]` (ADR-022).
- `src/proxy.ts` is the Next 16 replacement of `middleware.ts`.

## Folder layers

| Folder | Holds | May import |
|---|---|---|
| `src/app` | Routing, layouts, thin pages and route handlers | everything below |
| `src/features/<domain>` | One domain each (accounts, auth, entries, geography, visuals...) | `components`, `lib`, `config`, other features' non-component modules |
| `src/components` | Shared UI: `ui/` primitives, `atlas/` patterns, `admin/`, `data-table/`, `portrait/`, `map/`... | `lib`, `config`, feature `types`/`queries` |
| `src/lib` | Infrastructure: Supabase clients, security, cache tags, i18n, db helpers | `config` only |
| `src/config` | Constants with no app imports: `routes.ts`, `sections.ts`, `layout.ts`, `palette.ts` | nothing from `features` |

A component that calls a domain's Server Action or renders a domain component belongs in
`features/<domain>/components/`. A piece shared by two domains belongs in `components/`.

## The feature file pattern

Inside `src/features/<domain>/` use these names (not all are needed):

- `schema.ts` - Zod input schemas, shared by form and action.
- `queries.ts` - public reads. `import "server-only"`, `createPublicClient()` inside
  `unstable_cache` with tags, usually wrapped in React `cache()`.
- `editorial.ts` - admin reads under the user's session (`createServerClient()`), never cached.
- `actions.ts` - `"use server"` + `import "server-only"`. Big domains split into `*-actions.ts`
  (`entries/workflow-actions.ts`, `auth/email-actions.ts`).
- `types.ts` - client-safe types. `constants.ts` / `model.ts` - pure constants and logic.
  `rows.ts` - DB row to view-model mapping. `components/` - the domain's UI.
- Tests sit next to the code as `*.test.ts`.

Client components import types from `features/*/types.ts` and `lib/action-state.ts`, never from
`schema.ts` or a `server-only` module. `tests/unit/client-bundle.test.ts` fails if `zod` or
`@supabase/ssr` reaches a client bundle.

## ESLint guards (`eslint.config.mjs`)

These are errors, not warnings (`npm run lint` uses `--max-warnings=0`). Tests are exempt.

- `lib/**` and `config/**` must not import `@/features/**`.
- `components/**` must not import `@/features/*/*actions` or `@/features/*/components/**`.
- `features/X` must not import `@/features/Y/components/**` (generated per feature).
- `@supabase/supabase-js` only in `src/lib/supabase/**` (type imports allowed).
- `dangerouslySetInnerHTML` only in `components/atlas/SafeHtml.tsx`, `components/JsonLd.tsx`,
  `components/PrePaintScript.tsx`.
- No hand-built public URLs (`` `/country/${slug}` ``): use `routes.*`. No `"/admin..."` literals:
  use `adminRoutes.*` (a type such as `PageProps<"/admin/...">` is fine).
- No `fetch` in `src/components/**` or `features/**/components/**`: use `apiFetch()`.
- An exception goes through the `allowing()` helper with a comment that says why. Today there are
  two: `lib/i18n/request.ts` imports `ui-texts/queries`, and `components/Header.tsx` renders
  `NewsletterForm`. Do not add a third without an ADR.

## Data flow

- **Read (public):** page (Server Component) → `features/x/queries.ts` → `createPublicClient()`
  (anon key, RLS) inside `unstable_cache({ tags, revalidate })`.
- **Read (admin):** admin page → `features/x/editorial.ts` → `createServerClient()` (session, RLS).
- **Write:** form → Server Action (`formAction` / `idAction`) → session client → RLS or an RPC →
  `updateTag(tags.x)` + `revalidatePath(adminRoutes.x...)`. Details: `atlas-backend`.
- **Content state** (planned → draft → pending → published) changes only through RPCs, never a
  direct `update`.
- **Client to server:** a Server Action, or `apiFetch()` to our own `/api/*` route. The account
  menu loads `GET /api/me` only when it opens.
- Props: global `PageProps<"/[locale]/...">` / `LayoutProps<"/[locale]">`, generated by
  `next typegen` (part of `npm run typecheck`).

## Caching, static and ISR

- **Every public page is static or ISR.** Never `force-dynamic` on public content.
- **Public code never reads `cookies()` or `headers()`** - not in a page, a shared layout,
  `generateMetadata` or a helper they call. Texts come from `getT()` / `getMessagesFor()`, settings
  from `getSiteSettings()`; both are cached without cookies.
- ISR comes from `unstable_cache({ tags, revalidate: PUBLIC_REVALIDATE_SECONDS })`
  (`src/lib/cache/tags.ts`, 3600 s). Route handlers (feeds, sitemaps, llms.txt) use the literal
  `export const revalidate = 3600`. **Never raise this interval:** scheduled publishing
  (`publish_due_entries`, pg_cron) relies on it to reach the pages.
- Cache tags exist once, in `src/lib/cache/tags.ts` (`tags.*`, `entryPageTags`, `entryChangedTags`).
  Do not invent tag strings in features.
- Writes call `updateTag(tag)` (read-your-own-writes, Server Actions only). `revalidateTag` is not
  used. Do not introduce `"use cache"` piecemeal; moving to it is a separate, planned change.
- Slug pages use `generateStaticParams` + `export const dynamicParams = true` (with `false`, Next
  returns 404 after an `updateTag`). Slug layouts call `guardedLayout(exists, routes.x)` from
  `features/redirects/guard.ts` so a redirect or a real 404 happens before streaming.
- `force-dynamic` is only for: the admin layout, `(account)` pages, `preview/[token]`,
  `membership/checkout`, `[locale]/[...path]`, `api/*` and `auth/*`.
- **No access is HTTP 200, not `forbidden()`.** `experimental.authInterrupts` / `forbidden()` once
  made every page dynamic (PR #189). Render `<NoAccess />` (`components/admin/NoAccess`).
- CI guard: `scripts/check-static-routes.mjs` (job "Build, smoke a e2e") fails when home, about,
  topics, countries, portraits, news or view pages stop being prerendered. If it fails, find the
  dynamic API you added; do not edit the list.

## The 10 non-negotiable rules

1. **The DB decides, the app displays.** Authorization is RLS or a SECURITY DEFINER function.
2. **Right key for the job:** public reads = anon (`lib/supabase/public.ts`), user actions = session
   (`lib/supabase/server.ts`), service key only for narrow server tasks (`lib/supabase/service.ts`).
   No secret ever gets a `NEXT_PUBLIC_` prefix.
3. **Identity on the server is `supabase.auth.getUser()`**, never `getSession()` alone.
4. **Every mutation is a Server Action** built with `formAction` / `idAction`; content state
   changes only through RPCs; then `updateTag` + `revalidatePath`.
5. **Zod at every boundary**, with limits equal to the DB `CHECK` constraints.
6. **HTML only through the one allowlist** (`lib/security/sanitize.ts`) at save and at render
   (`<SafeHtml>`). URLs through `safeUrl()`, redirects through `safeRedirect()`.
7. **Public pages are static/ISR** and never read cookies or headers. Admin is `force-dynamic`
   + `privateMetadata()` (noindex).
8. **CSP stays strict:** session pages get a per-request nonce, static pages keep the shared
   policy, never `'unsafe-eval'` in production. A new external origin = `lib/security/csp.ts` + its
   test (`atlas-security`).
9. **Rate limits live in Postgres** (`rate_limits`), never in process memory.
10. **No filesystem writes at runtime** (Vercel is read-only); files go to Supabase Storage.

## Working agreements

- One task = one branch = one PR. Deploys only through the pipeline (`atlas-testing-release`).
- Code comments, test names, commit messages and admin UI text are English. Public text comes
  from `src/messages/en.json` and Admin → UI texts.
- The repo is public. Never commit anything in `docs/` except `docs/architecture/`, secrets,
  tokens or descriptions of unfixed vulnerabilities.
- Owner decisions that stay: the coin and spark animations, the "Support the Atlas" menu item,
  the hero alt texts, Stripe in test mode, no extra editorial approval gates (anyone invited into
  the team can edit content), readers self-register as `reader` with no admin access.

## Recording decisions

- A new architectural decision is a new row in `docs/architecture/10-rozhodnuti-adr.md`
  (next number after ADR-028). Never rewrite an old row; mark it "superseded by ADR-0xx".
- A deviation from these rules needs a note in the PR and an ADR row.
- Changed conventions: update this skill and the matching chapter in `docs/architecture/` in the
  same PR. Task status goes to `PLAN-REALIZACE.md`.
- Private findings (security, audits) stay in the gitignored `docs/`; refer to them only by ID.

## Checklist

- [ ] New code sits in the right layer and file (`queries` / `editorial` / `actions` / `types`).
- [ ] `npm run lint` passes with no new `allowing()` exception.
- [ ] No `cookies()`/`headers()` in a public path; the static-route check passes.
- [ ] Every write ends in `updateTag` with a tag from `lib/cache/tags.ts`.
- [ ] Client components import no schema or server-only module.
- [ ] New decision recorded as an ADR row; docs and skills updated if a convention changed.

## Anti-patterns

- Checking permissions only in a page or layout: actions are separate public endpoints.
- Reading the session in the root or `[locale]` layout "just for the header": every page goes dynamic.
- `force-dynamic` to "fix" stale data: use the right tag and `updateTag` instead.
- A `lib/` helper that imports a feature: move the shared part to `lib/` or `config/`.
- Raising `PUBLIC_REVALIDATE_SECONDS`: scheduled posts would appear late.

## Sources

- Next.js: Data security - https://nextjs.org/docs/app/guides/data-security
- Next.js: Revalidating (`updateTag`, `revalidateTag`) - https://nextjs.org/docs/app/getting-started/revalidating
- Next.js: Content Security Policy - https://nextjs.org/docs/app/guides/content-security-policy
- The Twelve-Factor App: Config - https://12factor.net/config
- Martin Fowler: Feature Toggles - https://martinfowler.com/articles/feature-toggles.html
