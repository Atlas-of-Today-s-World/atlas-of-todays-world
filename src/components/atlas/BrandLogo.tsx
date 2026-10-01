import { cn } from "@/lib/cn";

const SRC = {
  /** White wordmark for dark backgrounds (globe, dark bands). */
  light: "/brand/atlas-logo-white.svg",
  /** Ink wordmark for light backgrounds (pages, administration). */
  dark: "/brand/atlas-logo-dark.svg",
} as const;

/**
 * The original Atlas of Today's World wordmark (self-hosted SVG, 519 × 72).
 * Size it with a height class; the width follows the aspect ratio.
 */
export function BrandLogo({
  tone = "dark",
  className,
}: {
  tone?: keyof typeof SRC;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG, the optimizer is off
    <img
      src={SRC[tone]}
      alt="Atlas of Today's World"
      width={519}
      height={72}
      className={cn("block h-6 w-auto", className)}
    />
  );
}
