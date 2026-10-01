/** Konstanty hesel bez Zodu — smí je importovat i klientské komponenty editoru. */

/** Nejvýš kapitol v hesle (zadání chce 4–6; DB pustí 8). */
export const MAX_CHAPTERS = 8;

/** Doby platnosti sdíleného náhledu v hodinách (DB povolí 1 až 720). */
export const PREVIEW_HOURS = [24, 72, 168, 720] as const;
