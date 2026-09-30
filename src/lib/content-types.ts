/**
 * Typy a číselníky obsahu bez závislosti na `node:fs` – tenhle soubor smí
 * importovat i klientská komponenta. Načítání souborů žije v `content.ts`.
 */

export type NewsCategory =
  | "Living Conditions"
  | "Political System"
  | "Society"
  | "International Relations"
  | "Historical Roots";

export const NEWS_CATEGORIES: NewsCategory[] = [
  "Living Conditions",
  "Political System",
  "Society",
  "International Relations",
  "Historical Roots",
];

export interface TimelineItem {
  title: string;
  date: string;
  text: string;
}

export interface ResourceItem {
  title: string;
  source: string;
  url: string;
  image?: string;
  kind?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Ručně zadaný ukazatel u země nebo regionu.
 *
 * Automatické ukazatele z Our World in Data pokrývají devět veličin pro celý
 * svět (HDI, režim, korupce…). Zadání ale chce i čísla, která v OWID nejsou –
 * etnické skupiny, vysídlení, dětská chudoba, míra svobody. Ty píše redakce
 * ručně a podle zadání **se bez citace nepublikují**, takže `source` je povinný.
 *
 * Tvar odpovídá kartám na stávajícím webu: velká hodnota, název, věta
 * vysvětlení a pod tím zdroj s rokem.
 */
export interface MetricCard {
  /** Velké číslo na kartě, jako text – „10+", „24.4 %", „4/10", „17.8M". */
  value: string;
  /** Název ukazatele – „Youth Unemployment". */
  label: string;
  /** Věta, která říká, co to číslo znamená a koho se týká. */
  description?: string;
  /** Kdo to spočítal – „UNHCR", „Freedom House". Bez toho se karta nepublikuje. */
  source: string;
  sourceUrl?: string;
  /** Rok nebo období dat – „2024", „mid-2025". */
  year?: string;
}

/** Redakční doplňky portrétu regionu (src/content/regions/<slug>.json). */
export interface RegionDossier {
  /** Úvodní odstavec o socio-politické situaci regionu (P6, sekce první). */
  intro?: string;
  /** Ručně zadané ukazatele. Když jsou, mají přednost před dopočtem z OWID. */
  metrics?: MetricCard[];
  timelineTitle?: string;
  timelineSubtitle?: string;
  timeline?: TimelineItem[];
  visuals?: { title: string; image: string; caption: string }[];
  resources?: ResourceItem[];
  faq?: FaqItem[];
}
