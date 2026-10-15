/** Shapes of a site search hit, shared by the search read and the (client) search dock. */

export type SearchKind = "region" | "country" | "issue" | "news";

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  /** Snippet below the result. */
  body: string;
  url: string;
  /** Where to rotate the globe when the user opens the result. */
  center?: [number, number];
  zoom?: number;
  score: number;
}
