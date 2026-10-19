import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FALLBACK_PATRON_SETTINGS } from "@/features/membership/config";
import { DonationCard } from "./DonationCard";

const meta = {
  title: "membership/Donation card",
  component: DonationCard,
  // In the app the action is the startCheckout Server Action and the amounts
  // come from patron_settings; here the action does nothing.
  args: {
    action: () => {},
    donation: FALLBACK_PATRON_SETTINGS.donation,
    className: "max-w-md",
  },
} satisfies Meta<typeof DonationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Monthly: Story = {};

/** Eight presets and "Other amount" (the most the settings allow). */
export const ManyAmounts: Story = {
  args: {
    donation: {
      ...FALLBACK_PATRON_SETTINGS.donation,
      amounts: { monthly: [3, 5, 10, 15, 25, 50, 100, 250] },
      otherAmountPeriods: ["monthly"],
    },
  },
};

export const OnDarkBand: Story = {
  render: (args) => (
    <div className="bg-[var(--color-space)] p-8">
      <DonationCard {...args} />
    </div>
  ),
};
