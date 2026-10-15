import type { Locale } from "@/features/i18n/config";
import { type Messages } from "@/features/i18n/messages";
import { getMessagesFor, localeFrom } from "@/features/i18n/request";
import { renderOg } from "@/lib/og";

/** What a preview image shows: label, title, subtitle and accent colour. */
type OgCard = Parameters<typeof renderOg>[0];

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
    return renderOg(await card({ ...(await params), locale }, await getMessagesFor(locale)));
  };
}
