import type { EmbedProvider } from "@/lib/embeds";
import type { VisualKind, VisualOwnerKind } from "./constants";
import type { MapSpec } from "./map/types";

/** Whose visuals: the owner kind and its key (slug, or the topic's / subtopic's id). */
export interface VisualOwner {
  kind: VisualOwnerKind;
  key: string;
}

/** A visual as the admin editor holds it (plain data for the client form). */
export interface EditableVisual {
  id: string;
  kind: VisualKind;
  title: string;
  caption: string;
  source_label: string;
  source_url: string;
  provider: EmbedProvider | null;
  embed_url: string;
  image_url: string;
  height: number | null;
  map_spec: MapSpec | null;
  updated_at: string;
}
