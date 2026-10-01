import { RESOURCE_KINDS, type Collection } from "../schema";

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
    title: "Klíčové ukazatele",
    lead: "Ruční karty mají přednost před dopočtem z importovaných dat. Bez zdroje se karta nepublikuje.",
    itemLabel: "Karta",
    fields: [
      { name: "value", label: "Hodnota („6.9M“, „24 %“)", required: true, max: 30 },
      { name: "label", label: "Název", required: true, max: 80 },
      { name: "source", label: "Zdroj", required: true, max: 200 },
      { name: "source_url", label: "Odkaz na zdroj", kind: "url" },
      { name: "period", label: "Rok nebo období", max: 20 },
      { name: "description", label: "Co číslo znamená", kind: "textarea", max: 600, full: true },
    ],
  },
  timeline: {
    title: "Časová osa",
    lead: "Události, které vysvětlují dnešní situaci — od nejstarší.",
    itemLabel: "Událost",
    fields: [
      { name: "date_label", label: "Datum („1991“, „březen 2014“)", required: true, max: 60 },
      { name: "title", label: "Název", required: true, max: 200 },
      { name: "body", label: "Popis", kind: "textarea", max: 2000, full: true },
      { name: "image_url", label: "Obrázek (https)", kind: "url", full: true },
    ],
  },
  visuals: {
    title: "Mapy a grafy",
    lead: "Obrázky nebo vložené vizualizace (Flourish, World Bank).",
    itemLabel: "Vizuál",
    fields: [
      {
        name: "provider",
        label: "Typ",
        kind: "select",
        options: ["image", "flourish", "worldbank"],
        required: true,
      },
      { name: "title", label: "Název", required: true, max: 200 },
      { name: "url", label: "Adresa (https)", kind: "url", required: true, full: true },
      { name: "caption", label: "Popisek", max: 500, full: true },
    ],
  },
  resources: {
    title: "Zdroje jinde",
    lead: "Dokumenty, přednášky, reporty a databáze, které redakce doporučuje.",
    itemLabel: "Zdroj",
    fields: [
      { name: "kind", label: "Druh", kind: "select", options: RESOURCE_KINDS, required: true },
      { name: "title", label: "Název", required: true, max: 200 },
      { name: "source", label: "Kdo ho vydal", max: 120 },
      { name: "url", label: "Adresa (https)", kind: "url", required: true },
      { name: "image_url", label: "Náhledový obrázek (https)", kind: "url" },
      { name: "description", label: "Popis", kind: "textarea", max: 600, full: true },
    ],
  },
  faq: {
    title: "Časté otázky",
    lead: "Pět otázek, které lidé o tomto místě kladou nejčastěji.",
    itemLabel: "Otázka",
    fields: [
      { name: "question", label: "Otázka", required: true, max: 300, full: true },
      { name: "answer", label: "Odpověď", kind: "textarea", required: true, max: 3000, full: true },
    ],
  },
};
