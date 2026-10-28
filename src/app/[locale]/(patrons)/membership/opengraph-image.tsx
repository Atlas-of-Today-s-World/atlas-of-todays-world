import { THEME_COLORS } from "@/config/palette";
import { getAtlas } from "@/features/geography/queries";
import { ogImage, worldGlobe } from "@/features/seo/og-image";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Atlas Patrons — Atlas of Today's World";

export default ogImage(async ({ locale }, t) => ({
  kicker: t.og.patrons,
  title: `${t.patrons.heroTitle} ${t.patrons.heroTitleAccent}`,
  accent: THEME_COLORS.patron,
  globe: worldGlobe(await getAtlas(locale)),
}));
