import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { THEME_COLORS } from "@/config/palette";
import { globeSvg, type OgGlobe } from "@/lib/og-globe";
import { SITE_URL } from "@/lib/site";

/** Preview image size for social networks (Open Graph, X, LinkedIn). */
export const OG_SIZE = { width: 1200, height: 630 };

/** The globe's square, cut off by the right and top edges of the picture. */
const GLOBE = { size: 860, right: -250, top: -115 };
/** Light lilac of "A Global Portrait" on the dark background. */
const TAGLINE = "#a9b8ff";

let fonts: Promise<{ name: string; data: Buffer; weight: 300 | 400 | 800 }[]> | undefined;

/**
 * Manrope, the site's heading face (src/assets/fonts, SIL OFL), in the weights
 * the card uses. Literal paths, so the build ships the files with the function.
 */
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Manrope-Light.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Manrope-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Manrope-ExtraBold.ttf")),
  ]).then(([light, regular, extraBold]) => [
    { name: "Manrope", data: light, weight: 300 },
    { name: "Manrope", data: regular, weight: 400 },
    { name: "Manrope", data: extraBold, weight: 800 },
  ]);
  return fonts;
}

/** The brand line every picture carries: "Atlas of Today's World — A Global Portrait". */
export interface OgBrand {
  site: string;
  tagline: string;
}

/**
 * The one look of preview images (next/og): the Atlas's dark "space"
 * background, a globe on the right turned to the subject, the brand line,
 * and either the subject's label and name or — on the home picture — the
 * brand itself as the headline.
 */
async function render(
  globe: OgGlobe,
  { top, middle, bottom }: Record<"top" | "middle" | "bottom", React.ReactNode>,
) {
  const svg = await globeSvg(globe, GLOBE.size);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: `radial-gradient(circle at 78% 35%, #1b2650 0%, ${THEME_COLORS.space} 52%, ${THEME_COLORS.spaceDeep} 100%)`,
        color: "#fff",
        fontFamily: "Manrope",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img */}
      <img
        alt=""
        width={GLOBE.size}
        height={GLOBE.size}
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        style={{ position: "absolute", right: GLOBE.right, top: GLOBE.top }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage: `linear-gradient(90deg, ${THEME_COLORS.space} 0%, rgba(10,16,32,0.92) 38%, rgba(10,16,32,0) 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 720,
          height: "100%",
          padding: "64px 72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {top}
        {middle}
        {bottom}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}

const footer = (text: string) => (
  <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.6)" }}>{text}</div>
);

/** The name's size by its length: a short name big, a long one in up to four lines of the column. */
const titleSize = (length: number) =>
  length <= 12 ? 92 : length <= 28 ? 72 : length <= 60 ? 60 : 52;

const host = new URL(SITE_URL).host.replace(/^www\./, "");

/** A page's picture: brand line, the subject's label and name, the site's address. */
export function renderOg({
  brand,
  kicker,
  title,
  accent = THEME_COLORS.accentBright,
  globe,
}: {
  brand: OgBrand;
  kicker: string;
  title: string;
  accent?: string;
  globe: OgGlobe;
}) {
  const name = title.length > 110 ? `${title.slice(0, 107)}…` : title;
  return render(globe, {
    top: (
      <div style={{ display: "flex", alignItems: "baseline", fontSize: 26 }}>
        <span style={{ fontWeight: 800 }}>{brand.site}</span>
        <span style={{ margin: "0 12px", color: "rgba(255,255,255,0.4)" }}>—</span>
        <span style={{ color: "rgba(255,255,255,0.72)" }}>{brand.tagline}</span>
      </div>
    ),
    middle: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 18,
            fontSize: kicker.length > 36 ? 18 : 22,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.75)",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{ width: 44, height: 8, borderRadius: 4, marginRight: 14, background: accent }}
          />
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: titleSize(name.length),
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -1.5,
          }}
        >
          {name}
        </div>
      </div>
    ),
    bottom: footer(host),
  });
}

/** The site's own picture (home and pages without their own): the brand as the headline. */
export function renderHomeOg({
  brand,
  kicker,
  footnote,
  globe,
}: {
  brand: OgBrand;
  kicker: string;
  footnote: string;
  globe: OgGlobe;
}) {
  return render(globe, {
    top: (
      <div
        style={{
          display: "flex",
          fontSize: 22,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.6)",
        }}
      >
        {kicker}
      </div>
    ),
    middle: (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -1.5,
          }}
        >
          {brand.site}
        </div>
        <div
          style={{ display: "flex", marginTop: 6, fontSize: 52, fontWeight: 300, color: TAGLINE }}
        >
          {brand.tagline}
        </div>
      </div>
    ),
    bottom: footer(footnote),
  });
}
