import { routes } from "@/config/routes";
import { getEncyclopediaEntry } from "@/features/entries/topic-queries";
import { guardedLayout } from "@/features/redirects/guard";

/** Unknown topic → redirect or a real 404 before streaming (see guardedLayout). */
export default guardedLayout(
  async (slug, locale) => Boolean(await getEncyclopediaEntry(slug, locale)),
  routes.entry,
);
