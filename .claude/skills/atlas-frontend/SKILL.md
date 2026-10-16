---
name: atlas-frontend
title: Frontend (React and Next.js)
description: How to write UI code in Atlas of Today's World (Next.js 16, React 19, Tailwind 4) - server vs client components, where a component lives, the inventory of ui primitives and Atlas patterns to reuse, cva variants, apiFetch and Server Actions instead of fetch, forms with FormField + Zod + useServerAction, texts via getT/useMessages, URLs from routes.ts, Storybook stories, the client bundle guard and ESLint layer rules. Use when writing or reviewing any .tsx component, page, form, hook or client-side data call.
roles: [frontend]
---

# Frontend: React and Next.js in Atlas

Server Components by default, small client leaves, and one existing component for each job.
Before you write a component, find the one that already does it; if it is close, add a variant.

## Before you start

- **This is not the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/`
  before writing Next code (`AGENTS.md`). Most used: `01-app/02-guides/server-and-client-boundary.md`,
  `forms.md`, `server-actions.md`, `preserving-ui-state.md`, `keeping-pages-static.md`.
- Commands: `npm run typecheck` (runs `next typegen`), `npm run lint` (zero warnings),
  `npm test`, `npm run format`, `npm run storybook`.
- Related skills: `atlas-architecture` (layers, static/ISR, caching, the public render path),
  `atlas-backend` (Server Actions with `formAction`), `atlas-security` (`SafeHtml`, CSP),
  `atlas-performance` (bundle and image budgets, lazy MapLibre), `atlas-dedup`, `atlas-datatable`,
  `atlas-accessibility`, `atlas-visual-design`, `atlas-testing-release`.

## Rules

### Server and client

- A component is a Server Component unless it needs state, effects, event handlers or browser
  APIs. Put `"use client"` on the smallest leaf (`ShareButton`, `Rail`), not on a page or a
  layout.
- Pages are thin: they read data (`features/<domain>/queries.ts` or `editorial.ts`), check access
  and render components. Page props use the generated types: `PageProps<"/[locale]/…">`, and
  `params` / `searchParams` are Promises you `await`.
- Client bundle guard: a `"use client"` module must never reach `zod` or `@supabase/ssr`
  (`tests/unit/client-bundle.test.ts`). In practice: import types from `features/*/types.ts`,
  `ActionState` from `src/lib/action-state.ts`, and constants from Zod-free modules (for example
  `features/roles/labels.ts`), never from `schema.ts` or a `server-only` module.
- Per-visitor data on public pages is fetched by the browser on demand (the account menu calls
  `/api/me` when it opens), never read from cookies during the render (`atlas-architecture`).
- Browser-only values (window size, storage) go behind `useHydrated()` or an effect, so the server
  HTML and the first client render match.

### Where a component lives

- Shared by two domains → `src/components/`; one domain → `src/features/<domain>/components/`.
  Folder layers and the ESLint import rules that enforce them: `atlas-architecture`.
- A shared component never imports a Server Action; the page passes it in as a prop (see
  `VisualsEditor`'s `actions`).

### Component inventory: use these, do not rebuild them

Search order and the rule of three: `atlas-dedup`. Browse them all in Storybook.

| Need | Use | File |
|---|---|---|
| Button, link styled as a button | `Button`, `buttonVariants` | `components/ui/button.tsx` |
| Status pill | `Badge` (`tone`) | `components/ui/badge.tsx` |
| Modal, confirmation | `Dialog`; admin `ConfirmButton` | `components/ui/dialog.tsx`, `components/admin/ConfirmButton.tsx` |
| Menu or popover | `Popover` | `components/ui/popover.tsx` |
| Tabs in one page | `Tabs`, `TabPanel` | `components/ui/tabs.tsx` |
| Form field and controls | `FormField`, `Input`, `Textarea`, `Select`, `Checkbox`, `CheckboxControl`, `ColorField`, `RequiredNote` | `components/ui/field.tsx`, `checkbox.tsx`, `color-field.tsx` |
| Form submit and result | `ActionForm`, `SubmitButton`, `ActionStatus` | `components/ui/action-form.tsx`, `components/admin/` |
| Bot check on public forms | `Turnstile` | `components/ui/turnstile.tsx` |
| Carousel or row of cards | `Rail` (`scroll`, `grid`, `pages`) | `components/atlas/Rail.tsx` |
| Breadcrumbs | `Breadcrumbs` | `components/atlas/Breadcrumbs.tsx` |
| Lead line, empty line | `Lead`, `EmptyNote` | `components/atlas/Note.tsx` |
| Section label, stats, source link, photo credit | `SectionLabel`, `StatGrid`, `MetricCards`, `SourceLink`, `PhotoCredit` | `components/atlas/ui.tsx` |
| Photo card or tile | `PhotoCard`, `PhotoTile` | `components/atlas/` |
| FAQ or other disclosure | `Accordion` | `components/atlas/Accordion.tsx` |
| Page hero with photo | `ArticleHero`, `ArticleEnd` | `components/atlas/ArticleHero.tsx` |
| Share | `ShareButton` | `components/atlas/ShareButton.tsx` |
| HTML from the database | `SafeHtml` (server) | `components/atlas/SafeHtml.tsx` |
| Error, 404 | `ErrorState`, `RouteError` | `components/atlas/` |
| Index filters | `FilterHeader`, `useUrlParams` | `components/atlas/` |
| List of records | `DataTable` + `RowActions` | `components/data-table/` (`atlas-datatable`) |
| Iframe embed | `EmbedFrame` | `components/visuals/EmbedFrame.tsx` |
| Admin header, no access, read-only | `PageHeader`, `NoAccess`, `ReadOnly` | `components/admin/` |
| Admin rich text, upload, slug, pickers | `RichTextEditor`, `UploadField`, `SlugField`, `CountryPicker`, `OrderedPicker`, `RegionSelect`, `CollectionEditor` | `components/admin/` |

Close match: add a variant. No match: build it once at the shared level, with a story.

### Variants with cva

- Visual options are `cva` variants combined with `cn()` (`src/lib/cn.ts`). Export the variants
  (`buttonVariants`) and a `VariantProps` type so links and wrappers reuse them.
- Variant names say what, not how: `variant`, `tone`, `size`, `kind`. Always set
  `defaultVariants`.
- `className` from the caller is for placement (margin, grid position), not for restyling.
- A link that looks like a button: `<Link className={buttonVariants({ variant: "outline" })}>`.

### Data on the client

- Mutations go through Server Actions only (`atlas-backend`).
- Browser reads of our own JSON go through `apiFetch<T>(url, { signal, timeoutMs })`
  (`src/lib/api-fetch.ts`). ESLint bans `fetch` in `src/components/**` and
  `src/features/**/components/**`. Handle every `ApiError.kind` (`aborted` silently, the rest with
  an error state) and read the JSON defensively; there is no Zod on the client.
- Search as you type: `useDebouncedSearch(endpoint, query, { delay, enabled })`.

### Forms

- One pattern: `useServerAction(action)` → `<ActionForm action>` → `FormField` + control →
  `SubmitButton` + `ActionStatus`. `ActionForm` submits in a transition, so React 19 does not
  wipe the fields when validation fails.
- Lists where people add several items in a row: `useAddForm(action, clearOnSuccess)`.
- The Zod schema lives in `features/<domain>/schema.ts` and runs on the server in `formAction`;
  field errors come back in `state.fieldErrors`. On the client use HTML attributes (`required`,
  `maxLength`, `type`) for instant hints.
- Public forms return message codes (`invalidCodes`) and show them with `useFormErrors(state, text)`.
- Ids come from the field name, or from `useId()` when the component can appear twice on a page.
- Labels, errors and focus rules: `atlas-accessibility`.

### Text, links and HTML

- Public text: `const t = await getT()` on the server, `useMessages()` in client components,
  placeholders with `format(template, values)`. New keys go into `src/messages/en.json`.
  English only; never add a locale.
- Admin UI text is English and written in the component.
- URLs only from `routes.*`, `adminRoutes.*`, `apiRoutes` (`src/config/routes.ts`). ESLint bans
  hand-built `/country/${…}` and `"/admin…"` strings.
- Public links: `Link` from `@/components/i18n/Link`, router `useLocalizedRouter()`. Admin
  links: `next/link`.
- HTML from the database renders only through `SafeHtml` (`atlas-security`).

### React 19 and the compiler rules

- ESLint runs the React Compiler rules of `eslint-config-next` 16 at full strength. Fix the code,
  never disable the rule: keep render pure, no reading refs or writing state during render.
- Pass `ref` as a normal prop (no `forwardRef`).
- Pending state: `useTransition`, `useActionPending()` inside `ActionForm`, `useFormStatus` in a
  native form. Instant feedback: `useOptimistic`, with an error message if it fails.
- Never create a promise during render and hand it to `use()`.

### Storybook

- Every shared component in `src/components/**` has `Name.stories.tsx` next to it, with each
  variant and the light and dark tone. Domain components in `features/` may have one.
- Stories run in Vite; `.storybook/main.ts` stubs `@/features/uploads/actions`. Stub any new
  server import the same way rather than leaking server code into a story.

## How we do it in Atlas

```tsx
"use client";
export function RedirectForm({ redirect }: { redirect?: RedirectRow }) {
  const [state, action] = useServerAction(redirect ? updateRedirect : addRedirect);
  const errors = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="grid gap-4">
      <FormField id="redirect-from" label="Old path" required errors={errors.from_path}>
        <Input id="redirect-from" name="from_path" required defaultValue={redirect?.from_path} />
      </FormField>
      <SubmitButton pending="Saving…">Save redirect</SubmitButton>
      <ActionStatus state={state} />
    </ActionForm>
  );
}
```

## Checklist

- [ ] `"use client"` only where needed; no Zod or `@supabase/ssr` reachable from it.
- [ ] Component sits in the right folder; `npm run lint` passes with zero warnings.
- [ ] Reused an existing primitive or pattern, or added a cva variant with a story.
- [ ] No `fetch`, no hand-built URL, no hard-coded public text, no raw HTML.
- [ ] Forms use `ActionForm` + `useServerAction` + `FormField`; server validates with Zod.
- [ ] `npm run typecheck`, `npm test`, `npm run format:check` pass.

## Anti-patterns

- `"use client"` on a page to use one `useState`: ships the whole page to the browser.
- `import { SomeSchema } from "@/features/x/schema"` in a client form: pulls Zod into the bundle.
- `<form action={serverAction}>` for an edit form: React resets the fields on a validation error.
- A second carousel, table, modal or button component "because this one is a bit different".
- `fetch("/api/…")` in a component: no timeout, no abort, no typed error.
- Reading `searchParams` or cookies in a public page to personalise it: the page turns dynamic.

## Sources

- Next.js docs shipped with the repo: `node_modules/next/dist/docs/01-app/02-guides/` (online:
  https://nextjs.org/docs/app/guides)
- Next.js production checklist: https://nextjs.org/docs/app/guides/production-checklist
- React 19 release notes (actions, `useActionState`, `useOptimistic`, ref as prop): https://react.dev/blog/2024/12/05/react-19
- Tailwind CSS theme variables: https://tailwindcss.com/docs/theme
- class-variance-authority: https://cva.style/docs
- web.dev, optimising INP: https://web.dev/articles/optimize-inp
