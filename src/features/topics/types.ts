/** Topic shapes shared by the server reads and the (client) components that show them. */

/** An entry as a tile on the home map: its photo (or colour), title and place. */
export interface EntryTile {
  slug: string;
  title: string;
  image?: string;
  background?: string;
  /** The region or global issue it belongs to (the tile's kicker). */
  kicker?: string;
}
