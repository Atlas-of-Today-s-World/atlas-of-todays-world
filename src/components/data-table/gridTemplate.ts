/**
 * `grid-template-columns` of the table (ported from TealHub).
 *
 * The table is one CSS grid: header and body share the template, so a
 * content-dependent track (`max-content`, `auto`…) would make widths jump
 * as rows change page or filter, and the resize handle would fight it.
 * Tracks are therefore fixed lengths or fractions only — the test rejects
 * anything else.
 */

export interface GridTemplateInput {
  /** Widths of the visible columns from the left; `undefined` = default. */
  columnWidths: Array<string | undefined>;
  /** Width of the Actions column (`rowActionsWidth`), or `null` when the table has no actions. */
  actionsWidth: string | null;
  /** The table has a selection checkbox column. */
  hasSelect: boolean;
}

/** Default width of a column that does not set its own. */
export const DEFAULT_COLUMN_WIDTH = "minmax(120px, 1fr)";
export const SELECT_COLUMN_WIDTH = "36px";
/** Minimum width a user can drag a column down to. */
export const MIN_COLUMN_PX = 60;

/** A row action icon button (`size="rowIcon"`: `size-6`); 44 px on touch via `--row-icon`. */
export const ROW_ICON_PX = 24;
/** Space between the icon buttons (`RowActions`: `gap-0.5`). */
export const ROW_ICON_GAP_PX = 2;
/** Actions cell padding (`px-1.5` on both sides) + its sticky left border (1 px). */
export const ACTIONS_CELL_INSET_PX = 13;
/** Never narrower than two icons, so the "Actions" header label fits above a single one. */
export const MIN_ACTION_SLOTS = 2;

/**
 * Track of the Actions column for rows showing up to `maxActions` icon
 * buttons — count the most a row can ever show (the role's rights and every
 * conditional action), not what the current rows show, so no row is clipped.
 * The icon size is the `--row-icon` variable (24 px; `DataTable` raises it
 * to the 44 px touch size on coarse pointers, as the buttons grow there).
 */
export function rowActionsWidth(maxActions: number): string {
  const count = Math.max(MIN_ACTION_SLOTS, Math.ceil(maxActions));
  const fixed = (count - 1) * ROW_ICON_GAP_PX + ACTIONS_CELL_INSET_PX;
  return `calc(${count} * var(--row-icon, ${ROW_ICON_PX}px) + ${fixed}px)`;
}

const CONTENT_DEPENDENT = /\b(max-content|min-content|fit-content|auto)\b/;

/** The track is sized by its content, so it would shift with every page of rows. */
export function isContentDependentTrack(track: string): boolean {
  return CONTENT_DEPENDENT.test(track);
}

/** Builds `grid-template-columns`. Order from the left: select, data columns, actions. */
export function buildGridTemplate(input: GridTemplateInput): string {
  const tracks = [
    ...(input.hasSelect ? [SELECT_COLUMN_WIDTH] : []),
    ...input.columnWidths.map((width) => width ?? DEFAULT_COLUMN_WIDTH),
    ...(input.actionsWidth ? [input.actionsWidth] : []),
  ];
  return tracks.join(" ");
}

/** Width chosen by the user (px) wins over the column definition. */
export function columnTrack(
  defined: string | undefined,
  userPx: number | undefined,
): string | undefined {
  return userPx && userPx > 0 ? `${Math.max(MIN_COLUMN_PX, Math.round(userPx))}px` : defined;
}
