import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyNote, Lead } from "./Note";

const meta = {
  title: "atlas/Note",
  component: EmptyNote,
  args: { children: "No topics match your search." },
} satisfies Meta<typeof EmptyNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/** Every size and tone; inverse sits on the dark map glass. */
export const Variants: Story = {
  render: () => (
    <div className="grid gap-3">
      <EmptyNote>Page (md, soft) — no results.</EmptyNote>
      <EmptyNote tone="muted">Page (md, muted) — no topics yet.</EmptyNote>
      <EmptyNote size="sm" tone="muted">
        Admin list (sm, muted) — no articles in this group yet.
      </EmptyNote>
      <EmptyNote size="xs" tone="muted">
        Compact row (xs, muted) — nothing planned yet.
      </EmptyNote>
      <div className="rounded-xl bg-[var(--color-space)] p-3">
        <EmptyNote size="sm" tone="inverse">
          On the map glass (sm, inverse) — no news yet.
        </EmptyNote>
      </div>
    </div>
  ),
};

export const LeadParagraph: Story = {
  render: () => (
    <Lead className="max-w-md">
      The lead paragraph under a page title: a little larger line height for a few lines of text.
    </Lead>
  ),
};
