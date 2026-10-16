---
name: atlas-datatable
title: DataTable — the one table
roles: [frontend]
description: The one table component of Atlas of Today's World (components/data-table/DataTable, ported from TealHub). Use ALWAYS when adding or changing any list/table on the site (admin lists, audit logs, data values, invitations…) — never write a raw <table> or a custom list with filters.
---

# Atlas DataTable — the only table on the site

Every list of records is `DataTable` from `src/components/data-table/DataTable.tsx` (ADR-019,
ARCHITEKTURA 15.1). It already gives: full-text search, sort + filter per column (funnel in each
header), KPI chips, resizable / reorderable / hideable columns remembered per user, paging, row
selection with a bulk-action bar, CSV export of what is on screen, a sticky Actions column with
icon buttons. **Never** build another table, status-pill bar or "⋯" menu — extend this one.

The only exception is the permission matrix (`features/roles/components/PermissionMatrix.tsx`),
which is a grid of checkboxes, not a list of records.

## Usage (Server Component page → client table)

Rows are plain data, so the server page passes them straight in — no columns file per page,
no functions in column definitions.

```tsx
<DataTable
  tableKey="admin-entries"            // unique; preferences are stored under it
  caption="Articles"                  // accessible name of the table
  searchParam="q"                     // optional: mirror search into the URL (server narrows)
  searchPlaceholder="Search articles…"
  initialSort={{ key: "updated", dir: "desc" }}
  stats={optionStats("status", STATUS_OPTIONS)}   // KPI chips "All" + one per option
  toolbar={<ToolbarLink href={…} active={mine}>Only my articles</ToolbarLink>}
  emptyTitle="No articles yet"
  maxRowActions={2 + (canDelete ? 1 : 0)}  // most icons a row can show — sizes the Actions column
  columns={[
    { key: "title", label: "Title", link: true, sortable: true, filter: "text", width: "minmax(240px, 3fr)" },
    { key: "status", label: "Status", kind: "badge", options: STATUS_OPTIONS, sortable: true, filter: "select", width: "150px" },
    { key: "updated", label: "Updated", kind: "date", sortable: true, width: "128px" },
  ]}
  rows={items.map((item) => ({
    id: item.id,
    href: `/admin/…/${item.id}`,      // target of the `link` column
    values: { title: item.title, status: item.status, updated: item.updated_at },
    actions: <RowActions actions={[editAction(href), openAction(publicUrl), deleteAction(del.bind(null, item.id), `article ${item.title}`)]} />,
  }))}
/>
```

Column `kind`: `text | number | date | datetime | badge | tags | code | boolean | color`.
`filter`: `text` (contains) | `select` (options = `options` or distinct values) | `none`.
`width` is a CSS grid track (fixed or `fr` / `minmax`), never content-dependent.
`hidden: true` = off by default, user can show it in "Columns". `noExport` leaves it out of CSV.
Pre-rendered cells (`row.cells[key]`) only when a cell needs a link or a control.

## Row actions — every table has them

`RowActions` + helpers in `row-actions.ts` (server-safe, plain data). Icons: `edit` (Pencil),
`view` (Eye), `open` (ExternalLink, new tab), `share`, `archive`, `restore`, `revoke` (Ban),
`delete` (Trash2, red), `up` / `down` (ArrowUp / ArrowDown, from `moveActions`), `hide` / `show`
(EyeOff / Eye, from `visibilityAction` — confirmed like any other action), `on` / `off`
(Power / PowerOff, turn a switch on / off), `source` (FileCode, view a source file) and `download`
(Download; a link action with `download: true` renders a plain `<a download>`). Rules (TealHub owner rule):

1. One click, icons right in the row — no "⋯" menu. Order: edit → open/view → archive/restore/revoke → delete last.
2. Every record type the user can change gets its actions: **edit** (link to detail), **open on the site**
   when published, **archive/unpublish** when the domain has it, **delete** when the record may be removed.
   Show only actions the role is allowed to do (`can(access.permissions, section, "e" | "d")`);
   the DB (RLS / RPC) still decides.
3. Every server action is confirmed in a dialog (`ConfirmButton`) naming the record; destructive = `danger`.
   The only exception is moving a row in a hand-ordered list: `moveActions(up, down, { first, last })`
   gives two `instant` actions (no dialog — the opposite arrow undoes it); sort the table by the order column.
4. Actions call existing Server Actions bound to the row id (`deleteX.bind(null, id)`), returning `ActionState`;
   the table refreshes on success. Content state changes only through the workflow RPCs (e.g. `unpublishEntry`).
5. Each icon button has an accessible name + tooltip and grows to 44 px on touch.
6. Only icon buttons go in the Actions column (no text buttons, toggles or wrappers around `RowActions`).
   Its width is never hand-set: pass `maxRowActions` = the most icons **any** row can show — count every
   conditional action as present (published-only "open", status-dependent ones…) and gate only by the
   viewer's rights (`2 + (canMove ? 2 : 0) + (canDelete ? 1 : 0)`); default 1. `DataTable` sizes the
   column with `rowActionsWidth(n)` (`gridTemplate.ts`): `n × 24 px` icons + `(n − 1) × 2 px` gaps
   + 13 px cell padding and border, never less than two icons so the "Actions" header fits —
   1–2 → 63 px, 3 → 89, 4 → 115, 5 → 141, 6 → 167; on touch the icons count 44 px each
   (`--row-icon`), so nothing is clipped there either. Add an action to a table = raise its `maxRowActions`.

## Checklist for a new / changed list

- [ ] `DataTable` with a unique `tableKey`, `caption`, search, sortable + filterable columns.
- [ ] KPI chips (`optionStats`) when there is a status / type column.
- [ ] `RowActions` with edit / open / archive / delete as the domain allows, gated by permissions;
      `maxRowActions` = the most icons a row can show.
- [ ] Page-specific toggles go to `toolbar` as `ToolbarLink`, not custom pill bars.
- [ ] e2e: the list renders, a row action works (confirm dialog → result).
- [ ] New action icon or cell kind? Add it to `row-actions.ts` / `cells.tsx` and the Storybook story, not inline in a page.
