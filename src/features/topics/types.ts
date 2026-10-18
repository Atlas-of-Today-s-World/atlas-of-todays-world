/** Topic shapes shared by the server reads and the (client) components that show them. */

/** A subtopic as a tile: its topic, title, photo (or colour) and anchor on the topic page. */
export interface SubtopicTile {
  id: string;
  topicSlug: string;
  topicTitle: string;
  title: string;
  image?: string;
  background?: string;
  /** `topic-2` — the subtopic's place on its topic page. */
  anchor: string;
  createdAt: string;
}

/** An entry as a tile on the home map: its photo (or colour), title and place. */
export interface EntryTile {
  slug: string;
  title: string;
  image?: string;
  background?: string;
  /** The region or global issue it belongs to (the tile's kicker). */
  kicker?: string;
}
