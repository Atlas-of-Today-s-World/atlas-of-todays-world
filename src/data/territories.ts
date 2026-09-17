import rules from "@/data/territories.json";

/**
 * Sporná a nesamosprávná území: typy a pomocné funkce nad `territories.json`.
 *
 * Atlas se drží praxe OSN – jak území vede Organizace spojených národů, ne jak
 * vypadá faktická kontrola na zemi. Natural Earth kreslí hranice „de facto"
 * (Krym u Ruska, Golany u Izraele), takže se předpis aplikuje při generování
 * mapy v `scripts/fetch-geodata.mjs`.
 *
 * Je to redakční rozhodnutí zapsané jako data: když se změní, upraví se JSON
 * a pustí `npm run data:all`. Každý záznam nese dokument OSN, o který se opírá,
 * protože tyhle volby jsou politické a čtenář má právo vědět, podle čeho jsou.
 *
 * Jedna vědomá odchylka: Tchaj-wan kreslíme odděleně, i když ho OSN od
 * rezoluce 2758 samostatně nevede.
 */

export type TerritoryAction =
  /** Území se přesune od jednoho státu k druhému (řeže se geometrie). */
  | "transfer"
  /** Samostatný prvek Natural Earth se vlije do uznaného státu. */
  | "merge"
  /** Zůstává samostatný, jen se označí a popíše. */
  | "flag";

export type TerritoryStatus =
  /** Status neurčen nebo sporný – kreslí se čárkovaně, s vysvětlením. */
  | "disputed"
  /** Nesamosprávné území podle seznamu OSN. */
  | "non-self-governing"
  /** Území pod správou jiného státu, než ke kterému podle OSN patří. */
  | "occupied";

export interface TerritoryRule {
  /** Název prvku v Natural Earth (BRK_NAME u sporných ploch, NAME u zemí). */
  source: string;
  action: TerritoryAction;
  /** U `transfer` a `merge`: ISO3 státu, ke kterému území podle OSN patří. */
  to?: string;
  /** U `transfer`: ISO3 státu, kterému se plocha odebere. */
  from?: string;
  /** U `flag`: ISO3, pod kterým prvek zůstává (případně přepsané). */
  iso3?: string;
  /** Jméno, pod kterým se území ukáže na mapě a v profilu. */
  label?: string;
  status: TerritoryStatus;
  /** Věta do profilu země a do legendy. */
  note: string;
  /** Dokument OSN, o který se rozhodnutí opírá. */
  basis: string;
}

export const TERRITORY_RULES = rules as TerritoryRule[];

/** Poznámka k zemi podle jejího ISO3, pokud nějakou nese. */
export function territoryNote(iso3: string): TerritoryRule | null {
  return (
    TERRITORY_RULES.find((rule) =>
      rule.action === "flag" ? rule.iso3 === iso3 : rule.to === iso3,
    ) ?? null
  );
}

/** Všechny země, u kterých se v profilu i na mapě objeví vysvětlení statusu. */
export function flaggedIso3(): string[] {
  return TERRITORY_RULES.map((rule) =>
    rule.action === "flag" ? rule.iso3 : rule.to,
  ).filter((iso3): iso3 is string => Boolean(iso3));
}
