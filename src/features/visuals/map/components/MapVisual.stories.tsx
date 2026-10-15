import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { IRAN_STRIKES_SAMPLE, PALESTINIANS_SAMPLE } from "../samples";
import type { MapSpec } from "../types";
import { MapVisual } from "./MapVisual";
import { MapVisualBuilder } from "./MapVisualBuilder";

/**
 * Custom map visuals: the public renderer and the admin builder (the builder's
 * map is the renderer itself). MapLibre comes from public/maplibre/<version>/
 * as on the site — run `node scripts/copy-maplibre-worker.mjs` once.
 */
const meta = {
  title: "visuals/Custom map",
  component: MapVisual,
  parameters: { layout: "padded", nextjs: { appDirectory: false } },
  args: { spec: PALESTINIANS_SAMPLE, title: "Palestinians in the world" },
  render: (args) => (
    <div className="max-w-4xl">
      <MapVisual {...args} />
    </div>
  ),
} satisfies Meta<typeof MapVisual>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Plain light flat map: highlighted countries, circles and icons, labels, a legend. */
export const PalestiniansInTheWorld: Story = {};

/** Satellite globe framed on Iran: icons, pulsing nuclear sites, dark popups. */
export const StrikesInIran: Story = {
  args: { spec: IRAN_STRIKES_SAMPLE, title: "Strikes in Iran" },
};

/** On a phone the popup docks along the bottom of the map. */
export const OnAPhone: Story = {
  args: { spec: IRAN_STRIKES_SAMPLE, title: "Strikes in Iran" },
  render: (args) => (
    <div className="w-[360px]">
      <MapVisual {...args} />
    </div>
  ),
};

const GROUPS = [
  {
    label: "Regions",
    options: [
      {
        key: "middle-east",
        name: "Middle East",
        countries: ["IRN", "IRQ", "SYR", "JOR", "ISR", "PSE", "LBN", "SAU"],
      },
      {
        key: "south-america",
        name: "South America",
        countries: ["CHL", "ARG", "BRA", "PER", "COL"],
      },
    ],
  },
];

function Builder({ initial }: { initial: MapSpec | null }) {
  const [spec, setSpec] = useState<MapSpec | null>(initial);
  return (
    <div className="grid gap-6">
      <MapVisualBuilder value={spec} onChange={setSpec} groups={GROUPS} />
      <details className="text-[12px]">
        <summary>Spec (what is saved)</summary>
        <pre className="max-h-80 overflow-auto">{JSON.stringify(spec, null, 2)}</pre>
      </details>
    </div>
  );
}

/** The admin builder on a sample: map left, tabs right; drag points, click to add. */
export const Builder_Iran: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="bg-white p-4 text-[var(--color-ink)]">
      <Builder initial={IRAN_STRIKES_SAMPLE} />
    </div>
  ),
};

/** A new map: the builder starts from the whole world on a plain light map. */
export const Builder_New: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="bg-white p-4 text-[var(--color-ink)]">
      <Builder initial={null} />
    </div>
  ),
};
