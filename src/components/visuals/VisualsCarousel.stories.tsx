import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { VisualsCarousel } from "./VisualsCarousel";

const meta = {
  title: "visuals/VisualsCarousel",
  component: VisualsCarousel,
  args: {
    lead: "Selected visualisations from organisations that track this part of the world.",
    items: [
      {
        id: "1",
        kind: "embed",
        provider: "owid",
        url: "https://ourworldindata.org/grapher/life-expectancy",
        title: "Life expectancy",
        caption: "Period life expectancy at birth, in years.",
        source: { label: "Our World in Data", url: "https://ourworldindata.org/" },
      },
      {
        id: "2",
        kind: "image",
        url: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=70",
        title: "A map as a picture",
        caption: "A static image visual.",
      },
    ],
  },
} satisfies Meta<typeof VisualsCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Section: Story = {};
export const InSubtopic: Story = { args: { variant: "inline", lead: undefined } };
