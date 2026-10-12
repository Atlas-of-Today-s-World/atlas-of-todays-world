import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowRight, BookOpen } from "lucide-react";
import { routes } from "@/config/routes";
import { PhotoTile } from "./PhotoTile";

const PHOTO = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=60";
const HREF = routes.topic("migrant-smuggling");
const TITLE = "Smuggling routes across the central Mediterranean";

// PhotoTile's props are a union (link / button / box), so the stories render it directly.
const meta = {
  title: "atlas/PhotoTile",
  component: PhotoTile,
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhotoTile>;

export default meta;
type Story = StoryObj;

/** Related topic in a country panel (md, a link). */
export const Default: Story = {
  render: () => <PhotoTile href={HREF} image={PHOTO} title={TITLE} className="h-36" />,
};

/** Without a photo: the admin's colour under the same shade. */
export const Colour: Story = {
  render: () => <PhotoTile href={HREF} background="#1f3a5f" title={TITLE} className="h-36" />,
};

/** Subtopic tile of a topic: larger, raised, outlined while its panel is open. */
export const SubtopicActive: Story = {
  render: () => (
    <PhotoTile
      onClick={() => {}}
      size="lg"
      effect="raised"
      active
      image={PHOTO}
      title={TITLE}
      className="h-36"
    />
  ),
};

/** Over the home map: small, white focus ring, a kicker over the title. */
export const OnTheMap: Story = {
  render: () => (
    <div className="w-44 bg-[#0d1324] p-3">
      <PhotoTile
        href={HREF}
        size="sm"
        tone="dark"
        effect="lift"
        image={PHOTO}
        kicker="Migration"
        title={TITLE}
        className="h-32"
      />
    </div>
  ),
};

/** Next subtopic: a button, the label chip on top, content on the right. */
export const Stepper: Story = {
  render: () => (
    <PhotoTile
      onClick={() => {}}
      size="xl"
      effect="raised"
      align="end"
      image={PHOTO}
      className="h-36"
      badge={
        <span className="mb-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[13px] font-semibold tracking-[0.08em] uppercase backdrop-blur-sm">
          Next <ArrowRight aria-hidden className="size-4" />
        </span>
      }
      title={TITLE}
    />
  ),
};

/** Resource tile: half height, the icon beside the text; greyed out while empty. */
export const ResourceRow: Story = {
  render: () => (
    <PhotoTile
      size="lg"
      layout="row"
      effect="raised"
      disabled
      background="#1f3a5f"
      className="h-16"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
        <BookOpen aria-hidden className="size-4.5" />
      </span>
      <span className="font-display text-[13.5px] leading-tight font-bold">Field notes</span>
    </PhotoTile>
  ),
};
