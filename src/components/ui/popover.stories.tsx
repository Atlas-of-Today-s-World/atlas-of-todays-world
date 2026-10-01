import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { CheckboxControl } from "./checkbox";
import { Popover } from "./popover";

const meta = {
  title: "ui/Popover",
  component: Popover,
  args: {
    label: "Columns",
    trigger: (props) => (
      <Button variant="outline" size="dense" {...props}>
        Open popover
      </Button>
    ),
    children: (
      <div className="grid gap-1 p-1">
        {["Title", "Status", "Updated"].map((label) => (
          <label key={label} className="flex items-center gap-2">
            <CheckboxControl aria-label={label} defaultChecked /> {label}
          </label>
        ))}
      </div>
    ),
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Start: Story = {};
export const AlignEnd: Story = {
  args: { align: "end" },
  decorators: [(Story) => <div className="flex justify-end">{Story()}</div>],
};
export const IndeterminateCheckbox: Story = {
  args: {
    children: (
      <label className="flex items-center gap-2">
        <CheckboxControl aria-label="Select all" indeterminate /> Some rows selected
      </label>
    ),
  },
};
