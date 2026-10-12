import { THEME_COLORS } from "@/config/palette";
import { ogImage } from "@/features/seo/og-image";
import { OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Atlas Patrons — Atlas of Today's World";

export default ogImage((_params, t) => ({
  kicker: t.og.patrons,
  title: `${t.patrons.heroTitle} ${t.patrons.heroTitleAccent}`,
  subtitle: t.patrons.description,
  accent: THEME_COLORS.patron,
}));
