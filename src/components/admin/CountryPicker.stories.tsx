import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormField } from "@/components/ui/field";
import countries from "@/data/countries.generated.json";
import { CountryPicker } from "./CountryPicker";

const OPTIONS = countries
  .map(({ iso3, name }) => ({ iso3, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const GROUPS = [
  {
    label: "Regions",
    options: [
      {
        key: "east-asia",
        name: "East Asia",
        countries: ["CHN", "JPN", "KOR", "PRK", "MNG", "TWN"],
      },
    ],
  },
];

/** A global issue's member countries, as in the admin's issue form. */
function IssueCountries({ selected }: { selected: string[] }) {
  return (
    <div className="max-w-2xl">
      <FormField id="countries" label="Countries in this group">
        <CountryPicker
          id="countries"
          name="countries"
          options={OPTIONS}
          defaultSelected={selected}
          groups={GROUPS}
          shortcut={{ key: "world", name: "the world", countries: OPTIONS.map((c) => c.iso3) }}
        />
      </FormField>
    </div>
  );
}

const meta = {
  title: "admin/CountryPicker",
  component: IssueCountries,
} satisfies Meta<typeof IssueCountries>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { selected: [] } };

export const Some: Story = { args: { selected: ["UKR", "RUS", "POL", "MDA"] } };

/** Every country: the chips fold into "240 countries selected". */
export const WholeWorld: Story = { args: { selected: OPTIONS.map((c) => c.iso3) } };
