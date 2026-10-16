/**
 * Measures of the "Subtopics" tile grid of a topic's subtopics
 * (DossierExplorer, tiles that open a panel). A place's topics are rows by
 * theme now (ThemeTopics, 2026-10-16), no longer this grid.
 */

/** Heading of a tile section ("Subtopics", "Learn more"). */
export const DOSSIER_HEADING =
  "font-display text-[26px] font-semibold tracking-tight sm:text-[30px]";

/**
 * One grid of four equal columns on wide screens: subtopics fill three, a
 * topic's resource column the fourth.
 */
export const DOSSIER_GAP = "gap-3";

/** Height of a subtopic tile. */
export const SUBTOPIC_HEIGHT = "h-30 sm:h-36";

/** The subtopic tiles' own grid: two columns on phones, three from `sm`. */
export const SUBTOPIC_GRID = "mt-5 grid grid-cols-2 sm:grid-cols-3";
