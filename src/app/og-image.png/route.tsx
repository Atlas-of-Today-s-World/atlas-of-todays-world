import { renderOg } from "@/lib/og";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/request";

/**
 * Default preview image (1200×630) for pages without their own
 * opengraph-image: home, lists, about, data layers, legal pages.
 * A static route, rendered at build time; the `ui-texts` tag of its texts
 * renders it again after the team changes them in the admin.
 */
export const dynamic = "force-static";

export async function GET() {
  const t = await getMessagesFor(DEFAULT_LOCALE);
  return renderOg({
    kicker: t.og.defaultKicker,
    title: t.og.defaultTitle,
    subtitle: t.home.intro,
  });
}
