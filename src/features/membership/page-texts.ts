import { EDITABLE_TEXTS, type UiText } from "@/features/ui-texts/model";

/**
 * The Atlas Patrons page as Admin → Site pages edits it: its UI texts
 * (`patrons.*` in en.json, saved as `ui_text_overrides` like Admin → UI texts)
 * grouped by the page's sections, top to bottom, each with a readable label.
 * The donation amounts, the goal and the FAQ are data, edited in Admin →
 * Patron settings. No server dependency: the admin form imports it too.
 */

export interface PageTextField extends UiText {
  label: string;
  /** Shown with `RichText`: `**bold**` works. */
  rich: boolean;
}

export interface PageTextGroup {
  id: string;
  title: string;
  /** Where the texts show, when it isn't obvious. */
  note?: string;
  fields: PageTextField[];
}

/** Sections in page order: the keys under `patrons.` each one takes (first match wins). */
const GROUPS: readonly { id: string; title: string; note?: string; prefixes: string[] }[] = [
  {
    id: "meta",
    title: "Page title and search description",
    note: "The title is the browser tab and the breadcrumb; the description shows in search results and link previews.",
    prefixes: ["title", "description"],
  },
  { id: "hero", title: "Top of the page", prefixes: ["heroTitle", "heroLead", "heroCta"] },
  { id: "card", title: "Donation card", prefixes: ["card."] },
  { id: "benefits", title: "As a Patron, You Will", prefixes: ["benefitsTitle", "benefits."] },
  {
    id: "goal",
    title: "Our current goal",
    note: "The amounts come from Patron settings. “We are just getting started” shows until enough patrons have joined; then the progress replaces it.",
    prefixes: ["goal."],
  },
  {
    id: "newsletter",
    title: "Newsletter banner",
    note: "Shown while the newsletter switch is on.",
    prefixes: ["newsletter."],
  },
  {
    id: "faq",
    title: "FAQ",
    note: "The questions and answers themselves are in Patron settings.",
    prefixes: ["faqTitle"],
  },
  {
    id: "volunteer",
    title: "Volunteer form",
    note: "“Messages” are what the form says after sending.",
    prefixes: ["volunteer."],
  },
  { id: "final", title: "Closing band", prefixes: ["finalTitle"] },
  { id: "credit", title: "Website credit", prefixes: ["builtWith"] },
  {
    id: "thank-you",
    title: "Thank-you page (after a donation)",
    prefixes: ["thankYou."],
  },
  { id: "manage", title: "Manage your donation page", prefixes: ["manage."] },
  {
    id: "checkout",
    title: "Checkout",
    note: "Texts of the payment step: the demo checkout and the message when the Stripe page can't open.",
    prefixes: ["checkout."],
  },
];

/** Labels of the main page's texts (key without `patrons.`); others are derived from the key. */
const LABELS: Record<string, string> = {
  title: "Page title",
  description: "Search description",
  heroTitle: "Heading",
  heroTitleAccent: "Heading, coloured line",
  heroCta: "Button (leads to the volunteer form)",
  benefitsTitle: "Heading",
  faqTitle: "Heading",
  finalTitle: "Heading",
  finalTitleAccent: "Heading, coloured line",
  builtWith: "Credit text",
  builtWithLabel: "Credit link label (screen readers)",
  "goal.title": "Heading",
  "goal.pill": "Goal pill",
  "goal.name": "Goal name",
  "goal.lead": "Introduction",
  "goal.listIntro": "Before the list",
  "goal.earlyTitle": "Before enough patrons join: heading",
  "goal.earlyText": "Before enough patrons join: text",
  "goal.earlyCta": "Before enough patrons join: button",
  "volunteer.lead": "Introduction",
};

/** Texts the page shows through `RichText` (`**bold**`). */
const RICH = [/^heroLead\.\d+$/, /^benefits\.\d+\.text\.\d+$/, /^goal\.(lead|listIntro)$/];

const words = (segment: string) => {
  const spaced = segment.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** "heroLead.1" → "Hero lead 2", "benefits.0.text.1" → "Benefits 1 › Text 2". */
function derivedLabel(path: string, prefix: string): string {
  // Drop the section's own name ("goal.", "card.") — the group heading says it —
  // unless a list follows ("benefits.0…" stays "Benefits 1").
  const rest = path.slice(prefix.length);
  const own = prefix.endsWith(".") && !/^\d/.test(rest) ? rest : path;
  const parts: string[] = [];
  for (const segment of own.split(".")) {
    if (/^\d+$/.test(segment) && parts.length) parts[parts.length - 1] += ` ${Number(segment) + 1}`;
    else parts.push(words(segment));
  }
  return parts.join(" › ");
}

const PATRONS = "patrons.";

/** The page's groups with their editable texts, in en.json order within each group. */
export function patronsPageGroups(texts: readonly UiText[] = EDITABLE_TEXTS): PageTextGroup[] {
  const fields = GROUPS.map((): PageTextField[] => []);
  for (const text of texts) {
    if (!text.key.startsWith(PATRONS)) continue;
    const path = text.key.slice(PATRONS.length);
    const index = GROUPS.findIndex((group) => group.prefixes.some((p) => path.startsWith(p)));
    const prefix = GROUPS[index]?.prefixes.find((p) => path.startsWith(p));
    if (prefix === undefined) continue;
    fields[index]?.push({
      ...text,
      label: LABELS[path] ?? derivedLabel(path, prefix),
      rich: RICH.some((pattern) => pattern.test(path)),
    });
  }
  return GROUPS.map(({ id, title, note }, index) => ({
    id,
    title,
    note,
    fields: fields[index] ?? [],
  }));
}

/** Is this key one of the Patrons page's texts? */
export const isPatronsText = (key: string) => key.startsWith(PATRONS);
