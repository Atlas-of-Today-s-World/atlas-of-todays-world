---
name: atlas-dedup
title: No duplicates
description: The dedup principle of Atlas - every visual pattern, constant, data definition and helper exists once. Covers where to search before building, rule of three vs the wrong abstraction, the inventory of shared helpers and components, the CI tools (jscpd, knip, ESLint bans) and how to remove dead code safely. Use before creating any component, hook, helper, constant or type, when copying code, and when deleting or moving code.
roles: [frontend, backend]
---

# No duplicates

Every visual pattern, constant, data definition and helper exists **exactly once**. Before you
write something new, find the thing that already does it and use it, or extend it with a variant.
This also applies to the skills: each rule lives in one skill and the others link to it.

## Before you start

- Look at the catalogue: `npm run storybook` (port 6006) shows the shared components with their
  variants. Stories live next to components as `*.stories.tsx`.
- Related skills: `atlas-architecture` (layers), `atlas-frontend`, `atlas-visual-design` (tokens),
  `atlas-admin`, `atlas-datatable` (the one table).

## Search before you build

Search in this order and stop at the first fit. Search by name **and** by the Tailwind classes or
the literal value you are about to type (`grep -r "27rem" src`).

1. **Tokens:** `src/app/globals.css` (`@theme`), `src/config/layout.ts`, `src/config/palette.ts`.
2. **Primitives:** `src/components/ui/` (`Button`, `Badge`, `Dialog`, `Popover`, `Tabs`,
   `FormField`, `Input`, `Select`, `Checkbox`, `ActionForm`...).
3. **Atlas patterns:** `src/components/atlas/` (`Rail`, `Breadcrumbs`, `EmptyNote`, `PhotoCard`,
   `PhotoTile`, `ArticleHero`, `SafeHtml`, `SectionLabel`, `StatGrid`, `SourceLink`...).
4. **Domain blocks:** `src/components/portrait/`, `src/components/topics/`,
   `src/components/visuals/`, `src/components/admin/`, then `src/features/*/components/`.
5. **Helpers:** `src/lib/` and the domain's `model.ts` / `rows.ts`.

Then decide:

- **It exists:** use it.
- **Something similar exists:** add a variant (`cva` `variant` / `size` / `tone`), a prop or a
  slot. Do not copy the file to tweak it.
- **Nothing similar:** create it once, at the right level: shared by two domains →
  `src/components/`; one domain → `features/<domain>/components/`; pure logic → `src/lib/`.
  Add a story when it is a shared component.

## Rule of three, and the wrong abstraction

- The second copy is a warning; extract on the third. The exception: **knowledge** (a limit, a
  URL, a colour, a permission rule, a tag name) is shared from the first repeat.
- If a shared helper keeps growing boolean flags and per-caller branches, it is the wrong
  abstraction. Inline it back into the callers, delete the unused paths, then extract what is
  really common.
- Two things that look alike but change for different reasons are not duplicates. Keep them apart
  and say why in a comment.

## One definition for each kind of data

| What | The one place |
|---|---|
| Public URLs | `routes.*` in `src/config/routes.ts` (ESLint bans hand-built paths) |
| Admin URLs | `adminRoutes.*` (ESLint bans `"/admin..."` literals) |
| API URLs | `apiRoutes.*` |
| Menus | `getNavigation()` (table `nav_items`), fallback `src/config/navigation.ts` |
| Permission sections | `src/config/sections.ts` |
| Cache tags | `src/lib/cache/tags.ts` |
| Content kinds and categories | `src/lib/content-types.ts`, `features/entries/constants.ts` |
| Embed providers | `src/lib/embeds.ts` (also drives CSP and the DB `CHECK`) |
| Upload kinds and limits | `src/lib/upload-rules.ts` |
| Layout sizes, z-index, breakpoints | `globals.css` tokens mirrored in `src/config/layout.ts` (`layout.test.ts` keeps them equal) |
| Colours for code that can't read CSS | `src/config/palette.ts` (`palette.test.ts`) |
| Public text | `src/messages/en.json` + Admin → UI texts (`getT()`); one key per repeated text |
| Validation pieces | `src/lib/validation/common.ts` (`slug`, `text`, `httpsUrl`, `uuid`...) |
| DB limits | the `CHECK` constraint, mirrored by Zod (`atlas-backend`) |

## Shared helpers inventory

Use these; do not write another version.

**Data and actions**
- `must`, `rowsOf` (`lib/db/result.ts`), `ilikeAny` (`lib/db/filters.ts`), `mapDbError`
  (`lib/db/errors.ts`), `staffNames` (`lib/db/staff-names.ts`: team names for "by" columns).
- `formAction`, `idAction`, `affected`, `failed`, `signedIn`, `formObject`, `jsonField`,
  `listItemError` (`lib/actions.ts`); `ActionState` (`lib/action-state.ts`).
- `tags`, `entryPageTags`, `entryChangedTags` (`lib/cache/tags.ts`); `refreshEntry`
  (`features/entries/revalidate.ts`); `guardedLayout` (`features/redirects/guard.ts`).

**Client to server**
- `useServerAction`, `useAddForm`, `ActionForm`, `useActionPending`
  (`components/ui/action-form.tsx`).
- `apiFetch` (`lib/api-fetch.ts`) - the only way a component calls our `/api/*`.

**Text, settings, formatting**
- `getT`, `getMessagesFor` (`lib/i18n/request.ts`), `format` (`lib/i18n/messages.ts`).
- `getSiteSettings`, `getSocialLinks` (`features/site/queries.ts`).
- `formatDateTime`, `formatLongDate`, `formatNumber`, `formatPopulation`, `formatEuro`,
  `formatPercent`, `isoDay` (`lib/format.ts`); `slugify` (`lib/slug.ts`); `swap` (`lib/array.ts`);
  `firstParam` (`lib/query-params.ts`); `saturate` (`lib/color.ts`).
- `htmlToText`, `stripTags`, `wordCount`, `textToHtml` (`lib/text/html.ts`); `splitSlots`,
  `hasSlots` (`lib/text/html-slots.ts`).
- `photoUrl`, `PHOTO_WIDTH`, `isTrustedPhoto` (`lib/images.ts`).

**Hooks:** `useDebouncedSearch`, `useFocusTrap`, `useScrollMemory`, `useHydrated`
(`src/lib/use-*.ts`), `useUrlParams` (`components/atlas/url-filters.ts`).

**UI patterns**
- Carousels: `Rail` (the only one). Tiles and cards: `PhotoTile` (+ `tileStyle`), `PhotoCard`.
- Article header: `ArticleHero`. Portraits: `Portrait` + `ProfileSections` (region and global
  issue share them). Rich HTML: `SafeHtml`. Empty states: `EmptyNote`.
- Admin: `PageHeader`, `NoAccess`, `ConfirmButton`, `SubmitButton`, `ActionStatus`,
  `CollectionEditor`, `VisualsEditor`; tables: `DataTable` + `row-actions.ts` (`editAction`,
  `deleteAction`, `moveActions`...) - see `atlas-datatable`.
- SEO: `pageMetadata`, `staticPageMetadata`, `privateMetadata` (`features/seo/metadata.ts`),
  `breadcrumbNode` (`features/seo/jsonld.ts`).
- Icons: `lucide-react` only. Embeds: `EmbedFrame` only.

## CI tools

| Tool | Command | Rule | Runs |
|---|---|---|---|
| ESLint bans | `npm run lint` | layers, `routes`/`adminRoutes`, `apiFetch`, `SafeHtml`, supabase-js | every PR (blocking) |
| jscpd | `npm run check:dup` | `.jscpd.json`: `src/` without tests, `src/content`, `src/data`; a clone is 10+ lines and 70+ tokens; fails above 1 % | nightly `full-tests.yml` |
| knip | `npm run check:unused` | zero unused files, exports and dependencies; exceptions in `knip.json` | nightly `full-tests.yml` |
| Storybook build | `npm run build-storybook` | every story compiles | nightly |

jscpd and knip do not block a PR, so **run them locally** when you add, move or delete code. A red
nightly run means "fix before the next feature".

## Removing dead code safely

1. Find every user: `grep -rn "name" src tests scripts supabase .storybook` - include string
   references, `.bind(`, dynamic `import()`, stories, Storybook mocks and tests.
2. For a message key: it is typed (`Messages` = `typeof en.json`), so `npm run typecheck` finds
   code uses. Also check `EDITABLE_TEXTS` (`features/ui-texts/model.ts`): editors may have an
   override stored for it.
3. For a route: check `src/config/redirects.ts`, sitemaps and links in content; keep a redirect.
4. For a CSS class or token: grep `globals.css`, `config/layout.ts`, `config/palette.ts` and the tests that mirror them.
5. For a DB object: never drop it in the PR that stops using it. Contract it in a later migration
   (`atlas-backend`), and update `APP_RPCS` if it was an RPC.
6. Run `npm run typecheck && npm run lint && npm test && npm run check:unused`.

## Known duplicates

- The old list D1-D8 (`docs/architecture/04-komponenty-ui.md` §15.3) is fully resolved. Record any
  new duplicate you find but cannot remove there, with its target.
- Still open: `features/auth/actions.ts` declares its own `ActionState` next to
  `lib/action-state.ts`; the row pager `all()` is local to `features/geography/queries.ts`. If you
  touch these files, merge them into the shared version.
- When you edit a file that contains a duplicate, remove it in the same PR or write in the PR why not.

## Checklist

- [ ] Searched tokens → ui → atlas → domain → lib before creating anything new.
- [ ] No copied block of 10+ lines; similar UI uses a variant, not a fork.
- [ ] Constants, URLs, tags and limits come from their one place.
- [ ] New shared component has a story.
- [ ] `npm run check:dup` and `npm run check:unused` pass locally when code moved or was removed.

## Anti-patterns

- A second carousel, table, button style or date formatter "because mine is slightly different".
- Copying a component into another feature to avoid an ESLint layer error: move it to `components/`.
- A helper with five booleans to serve five callers: the wrong abstraction.
- Deleting an export knip reports without checking scripts, stories and DB tests that import it.

## Sources

- Sandi Metz: The Wrong Abstraction - https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- Refactoring Guru: When to refactor (rule of three) - https://refactoring.guru/refactoring/when
- knip - https://knip.dev/
- jscpd - https://github.com/kucherenko/jscpd
