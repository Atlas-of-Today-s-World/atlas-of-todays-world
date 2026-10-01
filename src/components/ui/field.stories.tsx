import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox, FormField, Input, Select, Textarea, describedBy } from "./field";

const meta = {
  title: "ui/FormField",
  component: FormField,
  args: { id: "title", label: "Title", children: null },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

const SLUG_ERROR = ["Lowercase letters and hyphens only."];

export const TextInput: Story = {
  render: () => (
    <FormField id="title" label="Title" required hint="At most 200 characters.">
      <Input id="title" {...describedBy("title", { hint: "At most 200 characters." })} />
    </FormField>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormField id="slug" label="Address (slug)" required errors={SLUG_ERROR}>
      <Input
        id="slug"
        defaultValue="Bad address"
        {...describedBy("slug", { errors: SLUG_ERROR })}
      />
    </FormField>
  ),
};

export const SelectAndTextarea: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <FormField id="category" label="Category">
        <Select id="category" defaultValue="Society">
          <option>Society</option>
          <option>Political System</option>
        </Select>
      </FormField>
      <FormField id="summary" label="Summary">
        <Textarea id="summary" rows={3} defaultValue="One or two sentences." />
      </FormField>
      <Checkbox label="Scheduled topic only" />
    </div>
  ),
};
