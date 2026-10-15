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
