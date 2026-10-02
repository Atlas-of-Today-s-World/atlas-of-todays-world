import { ImageResponse } from "next/og";
import { ORGANIZATION } from "@/config/organization";

/**
 * Square raster logo (512 px) for structured data (Organization.logo: Google
 * wants ≥ 112 px, raster is the safe choice), feeds and the web manifest.
 * The same globe as app/icon.svg; static route, rendered at build time.
 */
export const dynamic = "force-static";

export function GET() {
  const size = ORGANIZATION.logoSize;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a1020" }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <rect width="64" height="64" fill="#0a1020" />
        <circle cx="32" cy="32" r="20" fill="#1d3a5c" />
        <path
          d="M12 32h40M32 12c5 6 7.5 12.6 7.5 20S37 46 32 52c-5-6-7.5-12.6-7.5-20S27 18 32 12Z"
          fill="none"
          stroke="#7fb3d5"
          strokeWidth="2"
        />
        <path
          d="M20 24c4 1 6 3 10 2s6-3 10-1M18 40c5-1 8 2 13 1s7-3 12-2"
          fill="none"
          stroke="#e08585"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
