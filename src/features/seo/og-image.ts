import { regionColorMap } from "@/features/geography/model";
import type { Atlas } from "@/features/geography/types";
import type { Locale } from "@/lib/i18n/config";
import { type Messages } from "@/lib/i18n/messages";
import { getMessagesFor, localeFrom } from "@/lib/i18n/request";
import { type OgBrand, renderOg } from "@/lib/og";
import type { OgGlobe } from "@/lib/og-globe";

/** What a preview image shows: label, title, accent colour and globe (the brand line is added). */
type OgCard = Omit<Parameters<typeof renderOg>[0], "brand">;

/** Where the globe of a picture without a place of its own turns: Europe and Africa. */
const WORLD_CENTER: [number, number] = [12, 22];

/** "Atlas of Today's World — A Global Portrait", with a typographic apostrophe in the picture. */
export const ogBrand = ({ og }: Messages): OgBrand => ({
  site: og.site.replaceAll("'", "\u2019"),
  tagline: og.tagline,
});

/** Every country in its region's colour, as on the home globe. */
export const worldGlobe = (atlas: Atlas, center = WORLD_CENTER): OgGlobe => ({
  center,
  fills: regionColorMap(atlas.regions),
});

/** Only the subject's countries coloured (and outlined); the rest of the world muted. */
export const subjectGlobe = (
  center: [number, number],
  countries: string[],
  fill: string,
  pin = false,
): OgGlobe => ({
  center,
  fills: Object.fromEntries(countries.map((iso3) => [iso3, fill])),
  outline: countries,
  pin,
});

/** No place to show: the whole world muted. */
export const quietGlobe: OgGlobe = { center: WORLD_CENTER, fills: {} };

/**
 * The default export of an `opengraph-image.tsx` route: resolves the language
 * from the route params and its texts, then draws the card `card` picks in the
 * one look of `renderOg`. `size`, `contentType` and `alt` stay exported from the
 * route file itself, where Next reads them.
 */
export function ogImage<Params extends object = object>(
  card: (params: Params & { locale: Locale }, messages: Messages) => OgCard | Promise<OgCard>,
) {
  return async function Image({ params }: { params: Promise<Params & { locale: string }> }) {
    const locale = await localeFrom(params);
    const messages = await getMessagesFor(locale);
    const shown = await card({ ...(await params), locale }, messages);
    return renderOg({ ...shown, brand: ogBrand(messages) });
  };
}
