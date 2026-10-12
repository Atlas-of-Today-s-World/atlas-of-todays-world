import { routes } from "@/config/routes";
import { getAtlas } from "@/features/geography/queries";
import { guardedLayout } from "@/features/redirects/guard";

/** Unknown data layer → redirect or a real 404 before streaming (see guardedLayout). */
export default guardedLayout(
  async (indicator, locale) => (await getAtlas(locale)).indicatorById.has(indicator),
  routes.view,
  "indicator",
);
