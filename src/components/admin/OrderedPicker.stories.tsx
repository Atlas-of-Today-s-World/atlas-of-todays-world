import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormField } from "@/components/ui/field";
import { OrderedPicker } from "./OrderedPicker";

const LAYERS = [
  { value: "hdi", label: "Human Development Index" },
  { value: "life-expectancy", label: "Life expectancy at birth" },
  { value: "gdp-per-capita", label: "GDP per capita (PPP, int-$)" },
  { value: "political-regime", label: "Political regime" },
  { value: "democracy-index", label: "Electoral democracy index" },
  { value: "corruption", label: "Corruption Perceptions Index" },
  { value: "extreme-poverty", label: "Extreme poverty" },
  { value: "co2-per-capita", label: "CO₂ emissions per capita" },
];

/** A country card's indicators: picked in order, at most six. */
function CardIndicators({ selected }: { selected: string[] }) {
  return (
    <div className="max-w-md">
      <FormField id="featured" label="Indicators on the card">
        <OrderedPicker
          id="featured"
          name="featured_indicators"
          options={LAYERS}
          defaultSelected={selected}
          max={6}
          itemLabel="indicator"
        />
      </FormField>
    </div>
  );
}

const meta = {
  title: "admin/OrderedPicker",
  component: CardIndicators,
} satisfies Meta<typeof CardIndicators>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { selected: [] } };

export const Some: Story = { args: { selected: ["gdp-per-capita", "hdi", "political-regime"] } };

export const Full: Story = {
  args: {
    selected: [
      "hdi",
      "life-expectancy",
      "gdp-per-capita",
      "corruption",
      "extreme-poverty",
      "co2-per-capita",
    ],
  },
};
