import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Globe2, LayoutGrid } from "lucide-react";
import { ArticleEnd, ArticleHero, heroWash } from "./ArticleHero";

const meta = {
  title: "atlas/ArticleHero",
  component: ArticleHero,
  args: {
    alt: "The State of Inequality",
    crumbLabel: "Breadcrumb",
    crumbs: [
      { label: "Atlas", href: "/" },
      {
        label: "Topics",
        href: "/entries",
        pill: true,
        icon: <LayoutGrid aria-hidden className="size-3.5" />,
      },
      { label: "Society" },
    ],
    share: "The State of Inequality",
    title: "The State of Inequality",
    summary: "How income, rights and opportunity are shared out within minority groups.",
    background: "#24324a",
  },
} satisfies Meta<typeof ArticleHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A topic's header with its own colour (no photo in Storybook). */
export const Topic: Story = {};

/** A global issue without a photo: its map colour washes into night. */
export const GlobalIssue: Story = {
  args: {
    alt: "Russia–Ukraine War",
    background: undefined,
    wash: heroWash("#d9534f"),
    crumbs: [
      { label: "Atlas", href: "/" },
      {
        label: "Global issues",
        href: "/global-issues",
        pill: true,
        icon: <Globe2 aria-hidden className="size-3.5" />,
      },
      { label: "Global Issue" },
    ],
    share: "Russia–Ukraine War",
    title: "Russia–Ukraine War",
    subtitle: "The largest war in Europe since 1945",
    summary: "The full-scale invasion of February 2022 and its consequences across the region.",
  },
};

/** The closing row: back to the list, Share. */
export const End: StoryObj<typeof ArticleEnd> = {
  render: () => (
    <div className="p-6">
      <ArticleEnd href="/global-issues" label="All global issues" share="Russia–Ukraine War" />
    </div>
  ),
};
