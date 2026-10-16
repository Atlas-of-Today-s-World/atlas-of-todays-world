import { routes } from "@/config/routes";
import { getAtlas } from "@/features/geography/queries";
import { guardedLayout } from "@/features/redirects/guard";

/** Unknown region → redirect or a real 404 before streaming (see guardedLayout). */
export default guardedLayout(
  async (slug, locale) => (await getAtlas(locale)).regionBySlug.has(slug),
  routes.regionFull,
);
