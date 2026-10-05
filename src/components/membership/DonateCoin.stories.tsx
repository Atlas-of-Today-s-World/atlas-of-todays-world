import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DonateCoin } from "./DonateCoin";

const meta = {
  title: "membership/Donate coin",
  component: DonateCoin,
  args: { label: "Support the Atlas" },
  // In the app it sits over the dark globe, bottom right of the home map.
  render: (args) => (
    <div className="flex justify-end bg-[var(--color-space-deep)] p-8">
      <DonateCoin {...args} />
    </div>
  ),
} satisfies Meta<typeof DonateCoin>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Below the `sm` breakpoint only the coin shows (narrow the canvas to see it). */
export const OverTheMap: Story = {};
