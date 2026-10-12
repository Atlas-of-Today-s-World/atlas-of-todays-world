import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormField, Input } from "@/components/ui/field";
import { routes } from "@/config/routes";
import { SlugField, useSlug } from "./SlugField";

/** A name field with its slug: a new record's slug follows the name until edited. */
function NameWithSlug({ initial, readOnly }: { initial?: string; readOnly?: boolean }) {
  const slug = useSlug(initial);
  return (
    <div className="grid max-w-md gap-5">
      <FormField id="name" label="Name" required>
        <Input
          id="name"
          defaultValue={initial ? "Sahel" : undefined}
          onChange={(event) => slug.follow(event.target.value)}
        />
      </FormField>
      <SlugField slug={slug} hint={routes.issue(slug.value || "…")} readOnly={readOnly} />
    </div>
  );
}

const meta = {
  title: "admin/SlugField",
  component: NameWithSlug,
} satisfies Meta<typeof NameWithSlug>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {};

export const Existing: Story = { args: { initial: "sahel" } };

export const Locked: Story = { args: { initial: "sahel", readOnly: true } };
