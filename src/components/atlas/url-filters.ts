import { useSyncExternalStore } from "react";

/**
 * Filters and search text of a static index page (Topics, Global issues) live
 * in the URL — shareable, the back button works — read as an external store:
 * the server renders the unfiltered list (search engines), the browser then
 * narrows it. No server dependency; client components only.
 */

const URL_EVENT = "atlas:url-filters";

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
};
const readSearch = () => window.location.search;
const noSearch = () => "";

/** The page's query parameters (empty on the server and in the first render). */
export function useUrlParams(): URLSearchParams {
  return new URLSearchParams(useSyncExternalStore(subscribe, readSearch, noSearch));
}

/** Sets (a value) or removes (null, "") query parameters without a navigation. */
export function setUrlParams(update: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(update)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  window.dispatchEvent(new Event(URL_EVENT));
}

/**
 * The one active place filter among `kinds` (query parameter names), e.g.
 * `?country=ita`. Country keys are ISO3 codes, kept uppercase like the data.
 */
export function activeFilter<K extends string>(
  params: URLSearchParams,
  kinds: readonly K[],
): { kind: K; key: string } | null {
  for (const kind of kinds) {
    const value = params.get(kind);
    if (value) return { kind, key: kind === "country" ? value.toUpperCase() : value };
  }
  return null;
}
