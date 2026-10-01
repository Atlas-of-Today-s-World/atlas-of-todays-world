/**
 * Jediný zdroj názvů cache tagů (ARCHITEKTURA 4.2). Dotaz veřejného webu se
 * označí tagem, Server Action po zápisu zavolá `updateTag` se stejným (Next 16: hned neplatné, autor vidí svou změnu).
 */
export const tags = {
  /** Regiony, země, ukazatele, global issues — celý snapshot mapy. */
  atlas: "atlas",
  entries: "entries",
  entry: (slug: string) => `entry:${slug}`,
  portrait: (kind: "region" | "issue", slug: string) => `portrait:${kind}:${slug}`,
  /** Přepínače funkcí a režim údržby. */
  flags: "flags",
  /** Přesměrování starých adres (tabulka redirects). */
  redirects: "redirects",
} as const;

/** Záchranná síť: i bez invalidace se veřejná data obnoví nejpozději za hodinu. */
export const PUBLIC_REVALIDATE_SECONDS = 3600;
