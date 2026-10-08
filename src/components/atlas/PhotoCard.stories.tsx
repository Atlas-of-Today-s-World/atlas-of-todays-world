import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { routes } from "@/config/routes";
import { PhotoCard } from "./PhotoCard";

const PHOTO = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=60";

const meta = {
  title: "atlas/PhotoCard",
  component: PhotoCard,
  args: {
    href: routes.topic("migrant-smuggling"),
    image: PHOTO,
    title: "Migrant smuggling explained",
    description:
      "Who pays whom, along which routes, and why closing one route opens another a few hundred kilometres away.",
  },
} satisfies Meta<typeof PhotoCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A topic on /topics: the grid card with its place and a soft shade. */
export const Topic: Story = {
  args: { size: "lg", shade: true, kicker: "North Africa" },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

/** A news item in the dark "Our News" rail. */
export const News: Story = {
  args: { size: "md", titleAs: "h3", href: routes.news("sample-news") },
  decorators: [
    (Story) => (
      <div className="bg-[#141a2b] p-6">
        <Story />
      </div>
    ),
  ],
};

/** A source without a preview image: its category as the header. */
export const SourceWithoutPhoto: Story = {
  args: {
    size: "sm",
    external: true,
    href: "https://example.org/report",
    image: null,
    placeholder: "Reports",
    title: "Smuggling of migrants: global study",
    description: "UNODC",
  },
  decorators: [
    (Story) => (
      <div className="bg-[#141a2b] p-6">
        <Story />
      </div>
    ),
  ],
};
