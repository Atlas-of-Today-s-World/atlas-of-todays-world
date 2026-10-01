import { localeFrom } from "@/features/i18n/request";
import { redirectOrNotFound } from "@/features/redirects/queries";

/**
 * Adresy, které na webu neexistují (staré URL, přejmenované stránky): podle
 * tabulky `redirects` přesměruje, jinak vykreslí běžnou stránku 404.
 *
 * Konkrétní routy mají vždy přednost, sem padá jen to, co by bylo 404.
 * Renderuje se na požádání (ne ISR), aby se každá náhodná adresa od robotů
 * neukládala do cache; přesměrování se čtou z `unstable_cache`, ne z DB.
 */
export const dynamic = "force-dynamic";

export default async function UnknownPath({
  params,
}: {
  params: Promise<{ locale: string; path: string[] }>;
}) {
  const { path } = await params;
  return redirectOrNotFound(`/${path.join("/")}`, await localeFrom(params));
}
