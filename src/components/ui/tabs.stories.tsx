import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TabPanel, Tabs } from "./tabs";

const ITEMS = [
  { id: "view", label: "View" },
  { id: "countries", label: "Countries" },
  { id: "points", label: "Points" },
] as const;

type Id = (typeof ITEMS)[number]["id"];

/** Tabs with their panels; ←/→, Home and End move between tabs. */
function Example() {
  const [tab, setTab] = useState<Id>("view");
  return (
    <div className="grid max-w-md gap-4">
      <Tabs label="Settings" idBase="story-tabs" items={ITEMS} value={tab} onChange={setTab} />
      {ITEMS.map((item) => (
        <TabPanel key={item.id} idBase="story-tabs" id={item.id} selected={tab === item.id}>
          <p className="text-[14px]">The {item.label.toLowerCase()} panel.</p>
        </TabPanel>
      ))}
    </div>
  );
}

const meta = {
  title: "ui/Tabs",
  component: Example,
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
