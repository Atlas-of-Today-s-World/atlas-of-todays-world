import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DonationCard } from "./DonationCard";

const meta = {
  title: "membership/Donation card",
  component: DonationCard,
  // In the app the action is the startCheckout Server Action; here it does nothing.
  args: { action: () => {}, className: "max-w-md" },
} satisfies Meta<typeof DonationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Monthly: Story = {};

export const OnDarkBand: Story = {
  render: (args) => (
    <div className="bg-[var(--color-space)] p-8">
      <DonationCard {...args} />
    </div>
  ),
};
