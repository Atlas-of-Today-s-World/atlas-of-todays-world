import { pagePath } from "@/config/layout";
import { isAtOrUnder } from "@/config/routes";

/**
 * Which menu item is the current page (`aria-current="page"`). Kept apart from
 * model.ts so the client header pulls in nothing but this.
 *
 * An item's address may carry a query or an anchor (`/view/hdi#hun`); only its
 * path counts. The home page "/" matches only itself; any other path matches
 * itself and the pages under it (`/news` → `/news/some-story`). With several
 * matches the most specific path wins, the first item on a tie (two items may
 * share an address: "Support the Atlas" and "Atlas Patrons"). Links off the
 * site never match.
 */
export function activeItemId(
  items: readonly { id: string; href: string; external: boolean }[],
  pathname: string,
): string | null {
  const page = pagePath(pathname);
  let best: { id: string; length: number } | null = null;
  for (const item of items) {
    if (item.external) continue;
    const path = item.href.split(/[?#]/)[0] || "/";
    const matches = path === "/" ? page === "/" : isAtOrUnder(page, path.replace(/\/+$/, ""));
    if (matches && (!best || path.length > best.length))
      best = { id: item.id, length: path.length };
  }
  return best?.id ?? null;
}
