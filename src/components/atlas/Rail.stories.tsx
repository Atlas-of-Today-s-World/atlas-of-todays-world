import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Rail } from "./Rail";

const cards = Array.from({ length: 8 }, (_, i) => (
  <div
    key={i}
    className="w-56 shrink-0 snap-start rounded-xl border border-[var(--color-line)] bg-white p-4 text-[13px]"
  >
    Karta {i + 1}
  </div>
));

const meta = {
  title: "atlas/Rail",
  component: Rail,
  args: { label: "Ukázkový karusel", children: cards },
} satisfies Meta<typeof Rail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};
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
