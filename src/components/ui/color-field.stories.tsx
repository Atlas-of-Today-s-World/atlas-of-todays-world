import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ColorField } from "./color-field";

const meta = {
  title: "ui/ColorField",
  component: ColorField,
  args: { id: "tile-color", label: "Use a colour", defaultValue: null },
} satisfies Meta<typeof ColorField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { defaultValue: "#2f5d50" } };
