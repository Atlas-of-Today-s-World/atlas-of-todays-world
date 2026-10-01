import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox, FormField, Input, Select, Textarea, describedBy } from "./field";

const meta = {
  title: "ui/FormField",
  component: FormField,
  args: { id: "title", label: "Titulek", children: null },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const SLUG_ERROR = ["Jen malá písmena a pomlčky."];

export const TextInput: Story = {
  render: () => (
    <FormField id="title" label="Titulek" required hint="Nejvýš 200 znaků.">
      <Input id="title" {...describedBy("title", { hint: "Nejvýš 200 znaků." })} />
    </FormField>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormField id="slug" label="Adresa (slug)" required errors={SLUG_ERROR}>
      <Input
        id="slug"
        defaultValue="Špatná adresa"
        {...describedBy("slug", { errors: SLUG_ERROR })}
      />
    </FormField>
  ),
};

export const SelectAndTextarea: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <FormField id="category" label="Kategorie">
        <Select id="category" defaultValue="Society">
          <option>Society</option>
          <option>Political System</option>
        </Select>
      </FormField>
      <FormField id="summary" label="Perex">
        <Textarea id="summary" rows={3} defaultValue="Jedna až dvě věty." />
      </FormField>
      <Checkbox label="Jen plánované téma" />
    </div>
  ),
};
