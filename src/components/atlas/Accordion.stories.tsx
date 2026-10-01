import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Accordion } from "./Accordion";
import { BrandLogo } from "./BrandLogo";
import { RichText } from "./RichText";

const items = [
  { question: "Will the content be free for everyone?", answer: "Yes, fully open-access." },
  {
    question: "How can I cancel my donation?",
    answer: <RichText text="Anytime **via Stripe**, or email {email}." values={{ email: "us" }} />,
  },
];

const meta = {
  title: "atlas/Accordion",
  component: Accordion,
  args: { items },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {};
export const Comfortable: Story = { args: { size: "comfortable" } };

/** The original wordmark in both tones. */
export const Logo: Story = {
  render: () => (
    <div className="grid gap-4">
      <BrandLogo />
      <div className="bg-[var(--color-space)] p-4">
        <BrandLogo tone="light" />
      </div>
    </div>
  ),
};
