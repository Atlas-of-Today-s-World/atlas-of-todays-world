/**
 * Measures of the "Subtopics" tile grid, shared by a topic's subtopics
 * (DossierExplorer, tiles that open a panel) and a global issue's topics
 * (SubtopicTiles, tiles that link to the topic) — one look for both.
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
