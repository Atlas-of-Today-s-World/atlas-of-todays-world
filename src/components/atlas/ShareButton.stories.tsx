import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ShareButton } from "./ShareButton";

const meta = {
  title: "atlas/ShareButton",
  component: ShareButton,
  args: { title: "Ukraine" },
} satisfies Meta<typeof ShareButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop browsers copy the link and say so; phones open the share sheet. */
export const Default: Story = {};
