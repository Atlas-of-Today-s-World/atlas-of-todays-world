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
  /** Width of the Actions column, or `null` when the table has no actions. */
  actionsWidth: string | null;
  /** The table has a selection checkbox column. */
  hasSelect: boolean;
}

/** Default width of a column that does not set its own. */
export const DEFAULT_COLUMN_WIDTH = "minmax(120px, 1fr)";
export const SELECT_COLUMN_WIDTH = "36px";
/** Minimum width a user can drag a column down to. */
export const MIN_COLUMN_PX = 60;

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
