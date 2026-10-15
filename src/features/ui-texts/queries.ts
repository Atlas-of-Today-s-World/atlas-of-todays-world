import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { MessageOverrides } from "@/lib/i18n/messages";
import { PUBLIC_REVALIDATE_SECONDS, tags } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { validOverrides } from "./model";

/**
 * The team's changes to the UI texts — public read (layer: features/<domain>/queries.ts).
 * Anonymous, cookie-less client and `unstable_cache` under the `ui-texts` tag,
 * so pages that use the texts stay static / ISR; saving in the admin updates
 * the tag. The cached part throws on a database error, so a failure is never
 * cached; the wrapper then falls back to no overrides (the en.json texts), so
 * the site never breaks on this table.
 */

const readOverrides = unstable_cache(
  async (): Promise<{ key: string; value: string }[]> => {
    const { data, error } = await createPublicClient()
      .from("ui_text_overrides")
      .select("key, value");
    if (error) throw new Error(error.message);
    return data;
  },
  ["ui-text-overrides"],
  { tags: [tags.uiTexts], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

/** Changed texts by key (only rows that fit the current en.json); none when unreadable. */
export const getUiTextOverrides = cache(async (): Promise<MessageOverrides> => {
  try {
    return validOverrides(await readOverrides());
  } catch (error) {
    console.error("[ui-texts] overrides:", error instanceof Error ? error.message : error);
    return {};
  }
});
