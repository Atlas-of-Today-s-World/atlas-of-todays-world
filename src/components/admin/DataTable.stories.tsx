import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DataTable, type Column } from "./DataTable";

interface Row {
  id: string;
  title: string;
  status: string;
}

const columns: Column<Row>[] = [
  { key: "title", header: "Title", cell: (row) => row.title },
  { key: "status", header: "Status", cell: (row) => row.status, wide: true },
  { key: "edit", header: "", cell: () => <a href="#">Edit</a>, end: true },
];

const meta = {
  title: "admin/DataTable",
  component: DataTable<Row>,
  args: {
    rows: [
      { id: "1", title: "Elections in Moldova", status: "Published" },
      { id: "2", title: "Water crisis in Iran", status: "Draft" },
    ],
    columns,
    rowKey: (row: Row) => row.id,
    caption: "Articles",
  },
} satisfies Meta<typeof DataTable<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rows: Story = {};
export const Empty: Story = { args: { rows: [] } };
