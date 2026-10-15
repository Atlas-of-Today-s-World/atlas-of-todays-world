import generated from "@/data/countries.generated.json";
import type { MapBounds } from "./types";

/**
 * Countries for the builder (admin only — the public renderer never imports
 * this): names to pick from and the framing box of each (the same boxes the
 * globe flies to; mainland USA without Alaska, Russia up to 180°).
 */
interface GeneratedCountry {
  iso3: string;
  name: string;
  bbox: number[];
}

const countries = (generated as GeneratedCountry[]).filter((country) => country.bbox.length === 4);

export const COUNTRY_OPTIONS: { iso3: string; name: string }[] = countries
  .map(({ iso3, name }) => ({ iso3, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

export const COUNTRY_BOXES: Record<string, MapBounds> = Object.fromEntries(
  countries.map((country) => [country.iso3, country.bbox as MapBounds]),
);
