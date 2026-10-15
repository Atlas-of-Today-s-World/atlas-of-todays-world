import { DEFAULT_POPUP, type MapPoint, type MapSpec } from "./types";

/**
 * Two example maps for the Storybook stories and the tests — illustrative
 * data in the shape editors build, not figures to publish.
 */

const popup = (html: string, overrides: Partial<MapPoint["popup"]> = {}) => ({
  ...DEFAULT_POPUP,
  ...overrides,
  html,
});

const diaspora: [id: string, label: string, lat: number, lon: number, people: string][] = [
  ["jor", "Jordan", 31.95, 35.93, "≈ 2.3 million registered refugees"],
  ["gaz", "Gaza Strip", 31.42, 34.37, "≈ 2.1 million"],
  ["wbk", "West Bank", 31.95, 35.25, "≈ 3.2 million"],
  ["isr", "Israel", 32.79, 35.0, "≈ 1.7 million citizens"],
  ["syr", "Syria", 33.51, 36.28, "≈ 0.4 million"],
  ["lbn", "Lebanon", 33.89, 35.5, "≈ 0.2 million"],
  ["sau", "Saudi Arabia", 24.71, 46.68, "≈ 0.4 million"],
  ["are", "United Arab Emirates", 25.2, 55.27, "≈ 0.2 million"],
  ["egy", "Egypt", 30.04, 31.24, "≈ 0.1 million"],
  ["chl", "Chile", -33.45, -70.67, "≈ 0.5 million, the largest community outside the Arab world"],
  ["usa", "United States", 40.71, -74.0, "≈ 0.25 million"],
  ["deu", "Germany", 52.52, 13.4, "≈ 0.1 million"],
];

/** Palestinians in the world: circles sized by community, a legend, a light flat map. */
export const PALESTINIANS_SAMPLE: MapSpec = {
  version: 1,
  view: {
    mode: "bounds",
    countries: [],
    region: null,
    bounds: [-95, -45, 70, 62],
    projection: "mercator",
    basemap: "light",
    labels: true,
  },
  countries: [
    { iso3: "PSE", fill: "#1e9e5a", opacity: 0.75, outline: "#16794a" },
    { iso3: "JOR", fill: "#e0a526", opacity: 0.55, outline: null },
    { iso3: "CHL", fill: "#e0a526", opacity: 0.4, outline: null },
  ],
  points: diaspora.map(([id, label, lat, lon, people], index) => ({
    id,
    lat,
    lon,
    label,
    showLabel: index < 4,
    color: index < 3 ? "#16794a" : "#c2410c",
    size: index < 3 ? 26 : 16,
    icon: index < 3 ? "users" : null,
    pulse: false,
    popup: popup(
      `<p><strong>${people}</strong></p><p>Palestinians living in ${label}. <a href="https://www.unrwa.org/" rel="noopener noreferrer" target="_blank">UNRWA</a></p>`,
    ),
  })),
  legend: {
    visible: true,
    title: "Palestinians in the world",
    position: "bottom-left",
    items: [
      { label: "Palestinian territories and Jordan", color: "#16794a", icon: "users" },
      { label: "Diaspora community", color: "#c2410c", icon: null },
    ],
  },
};

const strikes: [
  id: string,
  label: string,
  lat: number,
  lon: number,
  icon: "bomb" | "crosshair" | "flame",
  text: string,
][] = [
  ["natanz", "Natanz", 33.72, 51.73, "bomb", "Uranium enrichment site."],
  ["fordow", "Fordow", 34.88, 50.99, "bomb", "Enrichment plant built into a mountain."],
  ["isfahan", "Isfahan", 32.65, 51.67, "bomb", "Nuclear technology centre."],
  ["tehran", "Tehran", 35.69, 51.39, "crosshair", "Strikes on command sites in the capital."],
  ["arak", "Arak", 34.37, 49.24, "crosshair", "Heavy water reactor."],
  ["kermanshah", "Kermanshah", 34.31, 47.07, "crosshair", "Missile bases in the west."],
  ["tabriz", "Tabriz", 38.08, 46.29, "crosshair", "Air base."],
  ["shahran", "Shahran depot", 35.77, 51.29, "flame", "Fuel depot on fire."],
];

/** Strikes in Iran: icons on a satellite globe, pulsing on the nuclear sites. */
export const IRAN_STRIKES_SAMPLE: MapSpec = {
  version: 1,
  view: {
    mode: "countries",
    countries: ["IRN"],
    region: null,
    bounds: [42.4804, 23.9286, 64.8476, 40.9424],
    projection: "globe",
    basemap: "satellite",
    labels: true,
  },
  countries: [{ iso3: "IRN", fill: "#b91c1c", opacity: 0.18, outline: "#fca5a5" }],
  points: strikes.map(([id, label, lat, lon, icon, text]) => ({
    id,
    lat,
    lon,
    label,
    showLabel: true,
    color: icon === "bomb" ? "#b91c1c" : icon === "flame" ? "#c2410c" : "#1f2a44",
    size: icon === "bomb" ? 30 : 22,
    icon,
    pulse: icon === "bomb",
    popup: popup(`<p>${text}</p><ul><li><em>Sample popup</em></li></ul>`, {
      font: "display",
      background: "#0d1324",
      color: "#ffffff",
      maxWidth: 240,
    }),
  })),
  legend: {
    visible: true,
    title: "Strikes",
    position: "top-left",
    items: [
      { label: "Nuclear site", color: "#b91c1c", icon: "bomb" },
      { label: "Military target", color: "#1f2a44", icon: "crosshair" },
      { label: "Fire", color: "#c2410c", icon: "flame" },
    ],
  },
};
