import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MetricCards, NewsBadge, SectionLabel, StatGrid, StatIcon, StatItem } from "./ui";

const meta = {
  title: "atlas/Stat cards",
  component: StatGrid,
  args: { children: null },
} satisfies Meta<typeof StatGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Labels: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <SectionLabel>Society</SectionLabel>
      <NewsBadge count={3} />
    </div>
  ),
};

export const Indicators: Story = {
  render: () => (
    <StatGrid className="max-w-md">
      <StatItem label="Human Development Index" value="0.734" icon={<StatIcon id="hdi" />}>
        Rank 100 of 191
      </StatItem>
      <StatItem label="Life expectancy" value="73.4 y" icon={<StatIcon id="life-expectancy" />} />
    </StatGrid>
  ),
};

export const ManualMetrics: Story = {
  render: () => (
    <MetricCards
      className="max-w-md"
      metrics={[
        {
          value: "6.7M",
          label: "Refugees abroad",
          description: "People who fled the country since 2022.",
          source: "UNHCR",
          sourceUrl: "https://www.unhcr.org/",
          year: "2025",
        },
        { value: "4/10", label: "Freedom score", source: "Freedom House", year: "2024" },
      ]}
    />
  ),
};
