import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Rail } from "./Rail";

const cards = Array.from({ length: 8 }, (_, i) => (
  <div
    key={i}
    className="w-56 shrink-0 snap-start rounded-xl border border-[var(--color-line)] bg-white p-4 text-[13px]"
  >
    Card {i + 1}
  </div>
));

const meta = {
  title: "atlas/Rail",
  component: Rail,
  args: { label: "Sample carousel", children: cards },
} satisfies Meta<typeof Rail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
export const Grid: Story = {
  args: {
    layout: "grid",
    gap: "sm",
    children: Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className="min-w-0 rounded-xl border border-[var(--color-line)] bg-white p-3 text-[13px] text-[var(--color-ink)]"
      >
        Entry {i + 1} — titles wrap instead of scrolling sideways
      </div>
    )),
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};
export const Dark: Story = {
  args: { tone: "dark" },
  decorators: [
    (Story) => (
      <div className="bg-[#0d1324] p-6">
        <Story />
      </div>
    ),
  ],
};
