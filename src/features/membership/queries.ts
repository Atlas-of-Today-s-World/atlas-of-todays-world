import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { FALLBACK_PATRON_SETTINGS, type PatronSettings } from "./config";
import { PATRON_SETTINGS_COLUMNS, settingsFromRow } from "./settings";

/**
 * Atlas Patrons — public reads (layer: features/<domain>/queries.ts), all
 * cached under tags.patrons. Only counts and sums of memberships leave the
 * database (patron_stats), never individual patrons.
 */

export interface PatronStats {
  patrons: number;
  monthlyEur: number;
}

/**
 * Aggregate progress towards the current goal. Anonymous readers only get the
 * two numbers from `patron_stats()` (security definer), never memberships.
 * Null when the database does not answer — the page then shows a dash.
 */
export const getPatronStats = unstable_cache(
  async (): Promise<PatronStats | null> => {
    const { data, error } = await createPublicClient().rpc("patron_stats");
    const row = data?.[0];
    if (error || !row) {
      console.error("[patron_stats]", error?.message ?? "no row");
      return null;
    }
    return { patrons: row.patrons, monthlyEur: Math.floor(Number(row.monthly_cents) / 100) };
  },
  ["patron-stats"],
  { tags: [tags.patrons], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

// A failed read throws inside the cache, so a database hiccup is never cached
// for an hour; the exported readers then fall back.
const loadSettings = unstable_cache(
  async (): Promise<PatronSettings> => {
    const { data, error } = await createPublicClient()
      .from("patron_settings")
      .select(PATRON_SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const settings = data ? settingsFromRow(data) : null;
    if (!settings) throw new Error("no valid row");
    return settings;
  },
  ["patron-settings"],
  { tags: [tags.patrons], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/**
 * Donation options and the goal (/admin/patrons). The donation card, the
 * goal section and the checkout validation all read this one value, so the
 * checkout accepts exactly what the card offers. Falls back to the values the
 * site had before they became editable.
 */
export async function getPatronSettings(): Promise<PatronSettings> {
  try {
    return await loadSettings();
  } catch (error) {
    console.error("[patron_settings]", error instanceof Error ? error.message : error);
    return FALLBACK_PATRON_SETTINGS;
  }
}

export interface PatronFaqItem {
  id: string;
  question: string;
  /** Sanitized on save; rendered through SafeHtml, `{email}` filled in by the page. */
  answerHtml: string;
}

const loadFaq = unstable_cache(
  async (): Promise<PatronFaqItem[]> => {
    const { data, error } = await createPublicClient()
      .from("patron_faq")
      .select("id, question, answer_html")
      .eq("visible", true)
      .order("sort")
      .order("id");
    if (error) throw new Error(error.message);
    return data.map((row) => ({ id: row.id, question: row.question, answerHtml: row.answer_html }));
  },
  ["patron-faq"],
  { tags: [tags.patrons], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Visible FAQ questions in their order; empty (the section is left out) when the database doesn't answer. */
export async function getPatronFaq(): Promise<PatronFaqItem[]> {
  try {
    return await loadFaq();
  } catch (error) {
    console.error("[patron_faq]", error instanceof Error ? error.message : error);
    return [];
  }
}
