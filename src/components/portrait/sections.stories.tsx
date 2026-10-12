import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ComingSections, FaqList, PatronsCallout, PortraitSection, Timeline } from "./sections";

const meta = {
  title: "portrait/Sections",
  component: PortraitSection,
  args: { title: "Key indicators", children: null },
} satisfies Meta<typeof PortraitSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Section: Story = {
  args: {
    title: "Key indicators",
    lead: "What the numbers say about everyday life.",
    children: <p className="mt-4 text-[14px]">Obsah sekce.</p>,
  },
};

export const NotWrittenYet: Story = {
  render: () => (
    <ComingSections
      items={[
        {
          title: "Timeline",
          lead: "An interactive timeline of the events behind the region's situation.",
        },
        { title: "FAQ", lead: "The five questions people ask most often about this region." },
      ]}
    />
  ),
};

export const TimelineRail: Story = {
  render: () => (
    <Timeline
      items={[
        { date: "1991", title: "Independence", text: "The country declares independence." },
        { date: "2014", title: "Annexation of Crimea", text: "Russia annexes the peninsula." },
        { date: "2022", title: "Full-scale invasion", text: "Russia invades on 24 February." },
      ]}
    />
  ),
};

export const Faq: Story = {
  render: () => (
    <FaqList
      items={[
        { question: "Who writes the Atlas?", answer: "An editorial team with regional experts." },
        { question: "How often is it updated?", answer: "News weekly, data when sources update." },
      ]}
    />
  ),
};

export const Patrons: Story = { render: () => <PatronsCallout complete={false} /> };
