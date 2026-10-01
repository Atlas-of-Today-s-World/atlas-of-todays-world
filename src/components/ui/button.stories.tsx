import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";

const meta = {
  title: "ui/Button",
  component: Button,
  args: { children: "Save" },
  argTypes: {
    variant: { control: "select", options: ["primary", "outline", "danger", "ghost"] },
    size: { control: "select", options: ["md", "sm", "chip", "icon"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Outline: Story = { args: { variant: "outline" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };
export const Small: Story = { args: { size: "sm" } };
export const Disabled: Story = { args: { disabled: true } };
