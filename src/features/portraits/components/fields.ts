import { RESOURCE_KINDS } from "../constants";
import type { Collection } from "../schema";

export interface ItemField {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "url" | "select";
  options?: readonly string[];
  required?: boolean;
  max?: number;
  /** Na širokém displeji přes celý řádek. */
  full?: boolean;
}

/** Jak se v editoru zobrazí položka každé sekce portrétu (tvar = schema.ts). */
export const COLLECTION_UI: Record<
  Collection,
  { title: string; lead: string; itemLabel: string; fields: ItemField[] }
> = {
  metrics: {
    title: "Key indicators",
    lead: "Manual cards take precedence over values computed from imported data. A card without a source isn't published.",
    itemLabel: "Card",
    fields: [
      { name: "value", label: "Value (“6.9M”, “24%”)", required: true, max: 30 },
      { name: "label", label: "Title", required: true, max: 80 },
      { name: "source", label: "Source", required: true, max: 200 },
      { name: "source_url", label: "Source link", kind: "url" },
      { name: "period", label: "Year or period", max: 20 },
      {
        name: "description",
        label: "What the number means",
        kind: "textarea",
        max: 600,
        full: true,
      },
    ],
  },
  timeline: {
    title: "Timeline",
    lead: "Events that explain today's situation — oldest first.",
    itemLabel: "Event",
    fields: [
      { name: "date_label", label: "Date (“1991”, “March 2014”)", required: true, max: 60 },
      { name: "title", label: "Title", required: true, max: 200 },
      { name: "body", label: "Description", kind: "textarea", max: 2000, full: true },
      { name: "image_url", label: "Image (https)", kind: "url", full: true },
    ],
  },
  visuals: {
    title: "Maps & charts",
    lead: "Images or embedded visualizations (Flourish, World Bank).",
    itemLabel: "Visual",
    fields: [
      {
        name: "provider",
        label: "Type",
        kind: "select",
        options: ["image", "flourish", "worldbank"],
        required: true,
      },
      { name: "title", label: "Title", required: true, max: 200 },
      { name: "url", label: "URL (https)", kind: "url", required: true, full: true },
      { name: "caption", label: "Caption", max: 500, full: true },
    ],
  },
  resources: {
    title: "Further resources",
    lead: "Documentaries, lectures, reports and databases recommended by the editors.",
    itemLabel: "Resource",
    fields: [
      { name: "kind", label: "Type", kind: "select", options: RESOURCE_KINDS, required: true },
      { name: "title", label: "Title", required: true, max: 200 },
      { name: "source", label: "Publisher", max: 120 },
      { name: "url", label: "URL (https)", kind: "url", required: true },
      { name: "image_url", label: "Thumbnail image (https)", kind: "url" },
      { name: "description", label: "Description", kind: "textarea", max: 600, full: true },
    ],
  },
  faq: {
    title: "FAQ",
    lead: "The five questions people ask most often about this place.",
    itemLabel: "Question",
    fields: [
      { name: "question", label: "Question", required: true, max: 300, full: true },
      { name: "answer", label: "Answer", kind: "textarea", required: true, max: 3000, full: true },
    ],
  },
};
