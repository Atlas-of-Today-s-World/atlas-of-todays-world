import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cn } from "@/lib/cn";
import { kickerVariants } from "./kicker";
import {
  MetricCards,
  NewsBadge,
  PhotoCredit,
  SectionLabel,
  StatGrid,
  StatIcon,
  StatItem,
} from "./ui";

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

/** The kicker tones (kicker.ts): pill = SectionLabel, muted on light, glass over the map. */
export const Kickers: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <span className={kickerVariants({ tone: "pill" })}>Pill</span>
      <span className={kickerVariants()}>In short</span>
      <span className={cn("glass rounded-xl p-3", kickerVariants({ tone: "glass" }))}>
        Latest subtopics
      </span>
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

/** Photo credit in a header's corner: over a dark gradient, and over a bare photo. */
export const PhotoCredits: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <div className="relative h-24 rounded-xl bg-[var(--color-space-deep)]">
        <PhotoCredit>Photo: Jana Nováková / Unsplash</PhotoCredit>
      </div>
      <div className="relative h-24 rounded-xl bg-gradient-to-r from-sky-200 to-amber-100">
        <PhotoCredit onPhoto>Photo: Jana Nováková / Unsplash</PhotoCredit>
      </div>
    </div>
  ),
};
