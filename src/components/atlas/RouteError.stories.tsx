import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RouteError } from "./RouteError";

const meta = {
  title: "atlas/RouteError",
  component: RouteError,
  args: {
    variant: "page",
    error: Object.assign(new Error("Story"), { digest: "1234567890" }),
    reset: () => {},
  },
} satisfies Meta<typeof RouteError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};
export const MapPanel: Story = { args: { variant: "map" } };
export const Admin: Story = { args: { variant: "admin" } };
export const WithoutDigest: Story = { args: { error: new Error("Story") } };
