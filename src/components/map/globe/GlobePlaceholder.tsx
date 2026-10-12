import { GLOBE_FILL_SIZE_CSS } from "@/lib/home-location";
import { cn } from "@/lib/cn";

/**
 * Until MapLibre (~300 kB) has loaded, a quiet sphere of the same size holds the
 * globe's place on the home page, so the first frame isn't an empty sky. It fades
 * out once the globe is painted (`faded`).
 */
export function GlobePlaceholder({ faded }: { faded: boolean }) {
  return (
    <div
      aria-hidden
      style={{ width: GLOBE_FILL_SIZE_CSS }}
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#3b5179_0%,#1d2c4a_45%,#0d1628_80%)] shadow-[0_0_80px_8px_rgba(74,111,165,0.35)] transition-opacity duration-1000",
        faded && "opacity-0",
      )}
    />
  );
}
