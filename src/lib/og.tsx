import { ImageResponse } from "next/og";

/** Preview image size for social networks (Open Graph, X, LinkedIn). */
export const OG_SIZE = { width: 1200, height: 630 };

/**
 * The single look of preview images (next/og): the Atlas's dark "space" background,
 * a label, title and subtitle. The color of the whole (region, issue) as a stripe.
 */
export function renderOg({
  kicker,
  title,
  subtitle,
  accent = "#3b4ce0",
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "radial-gradient(circle at 80% 30%, #1d2a55 0%, #0a1020 55%, #070b16 100%)",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            display: "flex",
            padding: "8px 16px",
            borderRadius: 8,
            background: "#fff",
            color: "#0d1324",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 3,
          }}
        >
          ATLAS OF TODAY&apos;S WORLD
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.7, textTransform: "uppercase" }}>
          {kicker}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{ display: "flex", width: 140, height: 10, borderRadius: 5, background: accent }}
        />
        <div
          style={{
            display: "flex",
            fontSize: title.length > 40 ? 64 : 80,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ display: "flex", fontSize: 32, opacity: 0.75, lineHeight: 1.3 }}>
            {subtitle.length > 140 ? `${subtitle.slice(0, 137)}…` : subtitle}
          </div>
        ) : null}
      </div>
    </div>,
    OG_SIZE,
  );
}
