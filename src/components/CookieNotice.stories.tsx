import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { COOKIE_NOTICE_KEY } from "@/config/cookies";
import { CookieNotice } from "./CookieNotice";

const meta = {
  title: "atlas/Cookie notice",
  component: CookieNotice,
  // Shown only until it has been seen in this browser: reset it for the story.
  beforeEach: () => {
    try {
      localStorage.removeItem(COOKIE_NOTICE_KEY);
    } catch {
      // Storage blocked: the notice shows anyway.
    }
  },
  render: () => (
    <div className="h-64 bg-[var(--color-space-deep)]">
      <CookieNotice />
    </div>
  ),
} satisfies Meta<typeof CookieNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First visit: counts down from 10 s and closes by itself (hover pauses it). */
export const FirstVisit: Story = {};
