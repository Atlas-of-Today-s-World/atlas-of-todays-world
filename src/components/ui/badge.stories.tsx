import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta = {
  title: "ui/Badge",
  component: Badge,
  args: { children: "Published" },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "accent", "success", "warning", "danger", "outline"],
    },
    size: { control: "select", options: ["sm", "md"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { children: "Draft" } };
export const Success: Story = { args: { tone: "success" } };
export const Warning: Story = { args: { tone: "warning", children: "Pending" } };
export const Danger: Story = { args: { tone: "danger", children: "Blocked" } };
export const Accent: Story = { args: { tone: "accent", children: "Editor" } };
export const Outline: Story = { args: { tone: "outline", children: "+3" } };
