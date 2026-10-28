import { getAtlas } from "@/features/geography/queries";
import { ogBrand, worldGlobe } from "@/features/seo/og-image";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/request";
import { renderHomeOg } from "@/lib/og";

/**
 * Default preview image (1200×630) for pages without their own
 * opengraph-image: home, lists, about, data layers, legal pages — the globe
 * in its region colours next to "Atlas of Today's World — A Global Portrait".
 * A static route, rendered at build time; the `ui-texts` tag of its texts
 * renders it again after the team changes them in the admin.
 */
export const dynamic = "force-static";

export async function GET() {
  const t = await getMessagesFor(DEFAULT_LOCALE);
  return renderHomeOg({
    brand: ogBrand(t),
    kicker: t.og.defaultKicker,
    footnote: t.og.defaultTitle,
    globe: worldGlobe(await getAtlas(DEFAULT_LOCALE)),
  });
}
