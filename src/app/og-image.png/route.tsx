import { getMessages } from "@/features/i18n/messages";
import { renderOg } from "@/lib/og";

/**
 * Default preview image (1200×630) for pages without their own
 * opengraph-image: home, lists, about, data layers, legal pages.
 * A static route, rendered once at build time.
 */
export const dynamic = "force-static";

export function GET() {
  return renderOg({
    kicker: "Non-profit encyclopedia of the present",
    title: "Every country, region and global issue on one globe",
    subtitle: getMessages("en").home.intro,
  });
}
