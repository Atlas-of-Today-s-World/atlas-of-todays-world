import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sparkline, daysAgoLabel, type SparkPoint } from "./Sparkline";

const series = (values: (number | null)[]): SparkPoint[] =>
  values.map((value, index) => ({
    value,
    label: `${daysAgoLabel(values.length - 1 - index)}: ${value ?? "no data"}`,
  }));

const meta = {
  title: "admin/Sparkline",
  component: Sparkline,
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Daily counts (the conversions on the admin overview). */
export const Counts: Story = {
  args: { points: series([0, 1, 0, 3, 2, 4, 1, 0, 5, 6, 2, 3, 7, 4]) },
};

/** Daily p75 with days without page views (web vitals): the line breaks. */
export const WithGaps: Story = {
  args: { points: series([2600, 2450, null, 2300, 2380, null, null, 2100, 1980, 2050]) },
};

/** Nothing counted yet: a flat line at zero. */
export const Empty: Story = {
  args: { points: series(Array.from({ length: 30 }, () => 0)) },
};
