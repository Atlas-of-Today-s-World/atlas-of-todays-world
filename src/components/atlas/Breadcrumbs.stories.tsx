import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LayoutGrid } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";

const meta = {
  title: "atlas/Breadcrumbs",
  component: Breadcrumbs,
  args: {
    label: "Breadcrumb",
    items: [
      { label: "Central Europe", href: "/region/central-europe" },
      { label: "Czechia", current: true },
    ],
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The country card's trail in the light panel. */
export const Light: Story = {};

/** Over the encyclopedia entry's photo header. */
export const Dark: Story = {
  args: {
    tone: "dark",
    items: [
      { label: "Atlas", href: "/" },
      {
        label: "Topics",
        href: "/topics",
        pill: true,
        icon: <LayoutGrid aria-hidden className="size-3.5" />,
      },
      { label: "Society" },
    ],
  },
  render: (args) => (
    <div className="bg-[var(--color-space)] p-6">
      <Breadcrumbs {...args} />
    </div>
  ),
};
