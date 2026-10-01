import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "./DataTable";
import { RowActions } from "./RowActions";
import type { ColumnDef, DataTableRow } from "./types";

type Key = "title" | "status" | "tags" | "author" | "words" | "updated";

const columns: ColumnDef<Key>[] = [
  {
    key: "title",
    label: "Title",
    link: true,
    sortable: true,
    filter: "text",
    width: "minmax(220px, 2fr)",
  },
  {
    key: "status",
    label: "Status",
    kind: "badge",
    sortable: true,
    filter: "select",
    width: "120px",
    options: [
      { value: "planned", label: "Planned", tone: "outline" },
      { value: "draft", label: "Draft", tone: "neutral" },
      { value: "pending", label: "Pending", tone: "warning" },
      { value: "published", label: "Published", tone: "success" },
    ],
  },
  { key: "tags", label: "Countries", kind: "tags", filter: "select" },
  { key: "author", label: "Author", sortable: true, filter: "select" },
  { key: "words", label: "Words", kind: "number", align: "right", sortable: true, width: "96px" },
  { key: "updated", label: "Updated", kind: "date", sortable: true, width: "128px" },
];

const STATUSES = ["planned", "draft", "pending", "published"] as const;
const TAGS = ["Ukraine", "Moldova", "Iran", "Sudan", "Brazil", "India"];
const AUTHORS = ["Jana Nováková", "Tom Hughes", "Amira Khan", null];

const noop = async () => ({ ok: true, message: "Done." });

const rows: DataTableRow<Key>[] = Array.from({ length: 64 }, (_, index) => ({
  id: String(index + 1),
  href: `/admin/entries/${index + 1}`,
  values: {
    title: `${["Elections", "Water crisis", "Drought", "Ceasefire"][index % 4]} ${index + 1}`,
    status: STATUSES[index % 4],
    tags: TAGS.slice(index % 5, (index % 5) + 1 + (index % 4)),
    author: AUTHORS[index % 4],
    words: (index * 137) % 2400,
    updated: new Date(Date.UTC(2026, 8, 1 + (index % 30))).toISOString(),
  },
  actions: (
    <RowActions
      actions={[
        { kind: "link", icon: "edit", label: "Edit", href: `/admin/entries/${index + 1}` },
        { kind: "link", icon: "open", label: "Open on the site", href: "/", newTab: true },
        {
          kind: "action",
          icon: "archive",
          label: "Archive",
          action: noop,
          confirmTitle: "Archive this entry?",
          confirmBody: "It disappears from the site but stays in the admin.",
        },
        {
          kind: "action",
          icon: "delete",
          label: "Delete",
          danger: true,
          action: noop,
          confirmTitle: "Delete this entry?",
          confirmBody: "This cannot be undone.",
        },
      ]}
    />
  ),
}));

const meta = {
  title: "data-table/DataTable",
  component: DataTable<Key>,
  args: {
    tableKey: "storybook-entries",
    caption: "Entries",
    columns,
    rows,
    initialSort: { key: "updated", dir: "desc" },
    actionsWidth: "120px",
    selectable: true,
    stats: [
      { key: "all", label: "All" },
      { key: "draft", label: "Drafts", column: "status", value: "draft" },
      { key: "pending", label: "Pending", tone: "warning", column: "status", value: "pending" },
      {
        key: "published",
        label: "Published",
        tone: "success",
        column: "status",
        value: "published",
      },
    ],
    toolbar: (
      <Button variant="outline" size="dense" aria-pressed={false}>
        <Archive aria-hidden className="size-3.5" /> Archived
      </Button>
    ),
  },
} satisfies Meta<typeof DataTable<Key>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};
export const Empty: Story = {
  args: {
    tableKey: "storybook-empty",
    rows: [],
    emptyTitle: "No entries yet",
    emptyDescription: "Create the first one with “New entry”.",
  },
};
export const Compact: Story = {
  args: { tableKey: "storybook-compact", rows: rows.slice(0, 5), compact: true, stats: undefined },
};
