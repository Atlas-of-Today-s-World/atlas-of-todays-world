---
name: atlas-admin
title: Admin (CMS)
description: How the Atlas of Today's World administration works and how to extend it - admin layout and menu (admin-nav.ts, adminRoutes), the permission model (roles x sections x v/c/e/d, the database decides), page structure, forms, destructive actions (confirm vs undo), drafts, revisions, previews and scheduled publishing, the Maps & charts editor, plus a short guide for editors. Use when building or changing an admin screen, menu item, permission check, admin form or workflow, or when an editor asks how to do something in the admin.
roles: [frontend, admin-user, editor]
---

# Admin (CMS)

The admin at [/admin](https://atlas-of-todays-world.vercel.app/admin) is where the invited team
edits everything on the site without a deploy. Every screen looks and behaves the same:
header, one table or form pattern, the same confirmation and status messages. The database
decides what each person may do; the UI only reflects it.

Editors: jump to [For editors](#for-editors).

## Before you start

- Related skills: `atlas-datatable` (every list), `atlas-frontend` (form mechanics),
  `atlas-backend` (Server Actions, RLS, RPCs, cache tags), `atlas-security` (sessions, 2FA),
  `atlas-accessibility`, `atlas-content` (what to write), `atlas-maps-data` (what makes a good
  map or chart).
- Look at a similar existing screen first: `src/app/admin/approvals/page.tsx` (list),
  `src/app/admin/redirects/` (list + form), `src/app/admin/content/[id]/page.tsx` (tabs, workflow,
  revisions, visuals).

## Rules

### Layout and menu

- `src/app/admin/layout.tsx` is `force-dynamic` with private (noindex) metadata. It signs the
  person in, asks for the second factor where the role needs it (`MfaGate`), shows a "No access"
  page to anyone who is not staff (readers), then renders the header, the `AdminNav` sidebar
  (15 rem) and `<main id="content">` across the full width. Forms and detail pages use that
  whole width; do not add `max-w-*` caps to admin screens.
- A new screen needs three things: a URL in `adminRoutes` (`src/config/routes.ts`: `records()`
  for a page per record, `editable()` when records are also created there, a plain string for a
  single page), a menu item in `ADMIN_NAV` (`src/config/admin-nav.ts`: label, section or sections,
  lucide icon), and `export const metadata = { title: "…" }` (the layout adds
  "— Atlas administration").
- The menu shows an item only when the person has `v` in one of its sections (`navVisible`).
  `section: null` = every team member.
- Admin links use `next/link` with `adminRoutes.*`; ESLint bans hand-written `"/admin…"`.
- Admin UI text is English, written in the component.

### Permissions

- Model: roles × 11 sections (`SECTIONS` in `src/config/sections.ts`: news, approvals, areas,
  regions, layers, appearance, specials, site, users, members, permissions) × actions `v` view,
  `c` create, `e` edit, `d` delete. Roles also carry whose articles they edit (`news_scope`) and
  which they approve (`approval_scope`); labels in `features/roles/labels.ts`.
- Every admin page starts with the same check, then uses `can()` only to show or hide controls:

```tsx
// src/app/admin/redirects/page.tsx: any one of the sections is enough to view.
const access = await sectionAccess(["news", "site"]);
if (!access) return <NoAccess />;
const canDelete = can(access.permissions, "news", "d");
```

- **UI checks are UX only.** RLS policies and RPCs decide. Every Server Action runs under the
  person's session; a write that RLS refuses touches zero rows and `affected()` turns that into a
  message (`atlas-backend`).
- Hide controls a role can never use. When a role may see but not change something, wrap it in
  `ReadOnly` (`readOnly`, `reason`), which disables the fieldset and says why.
- Owner decisions: anyone invited into the team may edit content; do not add new approval steps,
  per-item locks or extra sign-offs. Readers register as `reader` and never see the admin.
  The second factor is required only for the admin and permission-admin roles.
- A new section touches the DB CHECK, `my_permissions()`, `config/sections.ts` and
  `features/roles/labels.ts` in one PR (migration rules: `atlas-backend`).

### Page structure

- Top: `PageHeader` with `icon={navIcon(adminRoutes.x)}`, the menu label as `title`, a one-sentence
  `lead` saying what the screen is for, and the main action ("Add redirect") in `actions`.
- Lists: `DataTable` with `RowActions` (`atlas-datatable`). No other list or table.
- Record detail: its own page (`adminRoutes.x(id)`). A large record splits into tabs that are
  links with `?tab=` and `aria-current` (see `DossierTabs` in `admin/content/[id]/page.tsx`), so
  every tab has a URL.
- Forms live in `features/<domain>/components/*Form(s).tsx` and follow `atlas-frontend`: each
  section is a bordered box (`rounded-2xl border p-5`) with its own `h2`, `SubmitButton`, and
  `ActionStatus` next to it.
- Button labels name the action and the object: "Save redirect", "Approve and publish",
  "Schedule publication". Pending labels end with "…" ("Saving…").
- After a save the action calls `updateTag` for the public cache and `revalidatePath` for the
  admin list (`atlas-backend`); the form shows "Saved." in `ActionStatus`.

### Destructive actions: confirm or undo

| Action | Pattern |
|---|---|
| Move up / down in a hand-ordered list | Instant, no dialog (`moveActions`); the opposite arrow undoes it |
| Unpublish, hide, withdraw, cancel schedule | `ConfirmButton`; reversible, so prefer these to delete |
| Delete, revoke, anything hard to reverse | `ConfirmButton` with `variant="danger"` (or `quietDanger` icon) |

- The dialog title names the record and the consequence ("Delete the redirect /news/old?"), the
  body explains what happens, the confirm button repeats the action ("Delete redirect"). Cancel is
  always there and comes first.
- Content state changes only through the workflow RPCs (`submit_entry`, `withdraw_entry`,
  `approve_entry`, `unpublish_entry`, scheduling), never by writing `status` directly.
- Do not add type-to-confirm or double dialogs for ordinary records.

### Drafts, revisions, previews and scheduling

- Articles move planned → draft → pending → published (`ENTRY_STATUSES`) through
  `EntryWorkflow`. Shown with `StatusBadge`; who edited what with `EditStamp`.
- Scheduled publishing: `scheduleEntry` / `unscheduleEntry`; a database job publishes due articles.
  Show the time with its zone. Never raise the ISR revalidate interval; scheduled publishing
  relies on it.
- Revisions: `RevisionList` (last 30 versions, restore) and `VersionDiff` (`lib/diff.ts`) for
  articles; `PageRevisions` with the `restore_site_page` RPC for site pages. Both show who saved
  each version: `staffNames()` (`lib/db/staff-names.ts`, DB `staff_name`, staff only) turns
  `saved_by` into a name. Use it for any other "by" column; never read `profiles` for names.
- Unsaved article edits are backed up in the browser only (`useDraftBackup`, every 5 s); saving
  to the server is always an explicit click.
- Secret preview links: `PreviewShare` (`createPreviewLink`), opening `/preview/<token>` without
  Share and without indexing.
- Extend these mechanisms; do not build a second autosave, history or preview system.

### Maps & charts editor

- One editor for every owner (region, global issue, topic, subtopic): `VisualsEditor`
  (`src/components/admin/VisualsEditor.tsx`) = a `DataTable` of visuals (move, edit, delete) plus
  `VisualForm` below; `?visual=<id>` opens one in the form.
- The page passes the Server Actions in (`VISUAL_ACTIONS` from `features/visuals/admin`), plus
  `canEdit` / `canRemove` / `readOnlyReason`. The database (`can_edit_visual`) has the final word.
- The custom map builder (`MapVisualBuilder`) loads lazily through
  `features/visuals/map-builder-slot.ts` (admin only) and keeps its own undo history; when the
  form is at least 56 rem wide (a container query, not the window) the map takes 7/10 of the
  width and the panel 3/10 (at least 20 rem), otherwise the panel goes under the map. Add new
  builder controls inside its panel, not as separate admin screens.
- The view above the builder's map (`ViewStatus`) says what readers will see and whether it is
  saved. A free view follows the map (pan, zoom, save); a countries or region framing stays until
  "Use this view". "Reset to saved view" brings back the framing of the stored visual. Points
  without a title are flagged at once and block the save with a message, never silently.
- Visual kinds, embed providers, limits and what makes a good map or chart: `atlas-maps-data`.

## Checklist

- [ ] URL in `adminRoutes`, item in `ADMIN_NAV`, page `metadata.title`.
- [ ] `sectionAccess` + `NoAccess` at the top; `can()` only for showing controls; RLS covers the write.
- [ ] `PageHeader` with icon and lead; lists in `DataTable`; forms with `ActionForm` + `ActionStatus`.
- [ ] Destructive actions confirmed with a specific dialog; reversible options offered first.
- [ ] e2e: the screen renders for an allowed role and shows `NoAccess` for a forbidden one
      (`tests/admin-permissions.spec.ts`).

## Anti-patterns

- Checking permissions only in the UI: anyone can call a Server Action directly.
- `forbidden()` for "no access": use `NoAccess` (why: `atlas-architecture`).
- A custom list with its own filters or a "⋯" menu instead of `DataTable` and `RowActions`.
- A confirmation that says "Are you sure?" with "OK": it names neither the item nor the result.
- A new approval gate or sign-off step: against the owner's trust model.

## For editors

- **Sign in** at [atlas-of-todays-world.vercel.app/admin](https://atlas-of-todays-world.vercel.app/admin).
  Admins and permission admins also confirm a 6-digit code from an authenticator app.
- **You see only your sections.** "You don't have permission for this section" means your role
  lacks it; ask a permission admin ([Roles & permissions](https://atlas-of-todays-world.vercel.app/admin/roles)).
- **Write a topic:** [New topic](https://atlas-of-todays-world.vercel.app/admin/content/new?kind=entry).
  Fill the Key points box on the Article tab and In short on the SEO & GEO tab first; they are what
  readers see before the long text. Then Subtopics, Timeline, Maps & charts, Learn more.
- **Save often.** Unsaved changes are kept only in this browser as a safety net.
- **Publish:** Submit for approval, or Approve and publish / Schedule publication if your role
  approves. Share a draft with someone outside the team with a preview link. Publishing rules and
  what to check before approving: `atlas-content`.
- **Fix a mistake:** Unpublish rather than delete; restore an older version from the version list.
- **Site texts:** [UI texts](https://atlas-of-todays-world.vercel.app/admin/site/texts),
  [Site pages](https://atlas-of-todays-world.vercel.app/admin/pages),
  [Site menus](https://atlas-of-todays-world.vercel.app/admin/site/navigation).
- **These rules (skills):** read them in [Admin → Skills](https://atlas-of-todays-world.vercel.app/admin/skills),
  on the public [Skills page](https://atlas-of-todays-world.vercel.app/skills) or on
  [GitHub](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/tree/main/.claude/skills).
  To suggest a change, use "Edit on GitHub" (or open the file and click the pencil, e.g.
  [edit atlas-admin](https://github.com/Atlas-of-Today-s-World/atlas-of-todays-world/edit/main/.claude/skills/atlas-admin/SKILL.md)),
  then "Propose changes". GitHub opens a pull request (from a fork if you have no write access);
  a developer reviews it and it goes live with the next deploy.

## Sources

- NN/g, data tables: https://www.nngroup.com/articles/data-tables/
- NN/g, confirmation dialogs: https://www.nngroup.com/articles/confirmation-dialog/
- NN/g, form errors: https://www.nngroup.com/articles/errors-forms-design-guidelines/
- Sanity, drafts and history: https://www.sanity.io/docs/user-guides/history-experience
- Payload, autosave: https://payloadcms.com/docs/versions/autosave
- Next.js production checklist (authorise in every action): https://nextjs.org/docs/app/guides/production-checklist
