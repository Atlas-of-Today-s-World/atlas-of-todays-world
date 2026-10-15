import "server-only";
import type { Locale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/request";
import { categoryLabel } from "@/lib/content-types";

/**
 * Dates and section of an article (news item or topic), the same in its page
 * metadata (Open Graph `article:*`) and its JSON-LD: modified falls back to
 * published, the section is the category's label in the text's language.
 */
export async function articleMetaOf(item: {
  published?: string;
  updated?: string;
  category: string;
  locale: Locale;
}) {
  return {
    published: item.published,
    modified: item.updated ?? item.published,
    section: categoryLabel(item.category, await getMessagesFor(item.locale)),
  };
}
