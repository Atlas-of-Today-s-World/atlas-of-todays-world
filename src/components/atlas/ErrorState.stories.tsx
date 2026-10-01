import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorState } from "./ErrorState";

const meta = {
  title: "atlas/ErrorState",
  component: ErrorState,
  args: {
    code: "404",
    title: "Page not found",
    lead: "The page may have moved, or the address has a typo.",
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFound: Story = {};
export const LoadError: Story = {
  args: { code: undefined, title: "Something went wrong", lead: "Try again in a moment." },
};
