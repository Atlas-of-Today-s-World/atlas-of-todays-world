import { ImageResponse } from "next/og";
import { ORGANIZATION } from "@/config/organization";

/**
 * Square raster logo (512 px) for structured data (Organization.logo: Google
 * wants ≥ 112 px, raster is the safe choice), feeds and the web manifest.
 * The same white "A" on black as app/icon.svg (the original Atlas mark);
 * static route, rendered at build time.
 */
export const dynamic = "force-static";

export function GET() {
  const size = ORGANIZATION.logoSize;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#000" }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <rect width="64" height="64" fill="#000" />
        <path
          fill="#fff"
          fillRule="evenodd"
          d="M26 14h12l9.5 33.5h-8L37.6 40H26.4l-1.9 7.5h-8ZM28.2 33.5h7.6L32 20.5Z"
        />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
