import { Globe, Heart } from "lucide-react";
import Link from "@/components/i18n/Link";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { cn } from "@/lib/cn";

/** Edge discs between the two faces: they give the turning coin its thickness. */
const EDGE = [-1.2, -0.6, 0, 0.6, 1.2];

/**
 * Small glass button with a slowly turning gold coin, linking to the Atlas
 * Patrons donation page. On narrow screens only the coin shows (the label
 * stays for screen readers); the button keeps the 44 px touch target.
 */
export function DonateCoin({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href={MEMBERSHIP_PATH}
      data-print="hide"
      className={cn(
        "glass glass-hover group pointer-events-auto flex h-11 min-w-11 items-center gap-2.5 rounded-full px-1.5 text-sm font-medium text-white transition sm:pr-4",
        "hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]",
        className,
      )}
    >
      <span aria-hidden className="relative grid size-8 shrink-0 place-items-center">
        <span className="absolute -inset-1.5 animate-[coin-glow_3s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(232,181,58,0.55),transparent_70%)] transition-opacity group-hover:opacity-100" />
        <span className="relative size-8 [perspective:160px]">
          <span className="relative block size-full animate-[coin-spin_5s_cubic-bezier(0.45,0.05,0.35,1)_infinite] [transform-style:preserve-3d]">
            {EDGE.map((z) => (
              <span
                key={z}
                className="absolute inset-0 rounded-full bg-[var(--color-gold-edge)]"
                style={{ transform: `translateZ(${z}px)` }}
              />
            ))}
            <span className="coin-face absolute inset-0 grid [transform:translateZ(1.5px)] place-items-center rounded-full [backface-visibility:hidden]">
              <Globe className="size-4 text-[var(--color-gold-edge)]" strokeWidth={2} />
            </span>
            <span className="coin-face absolute inset-0 grid [transform:rotateY(180deg)_translateZ(1.5px)] place-items-center rounded-full [backface-visibility:hidden]">
              <Heart className="size-4 text-[var(--color-gold-edge)]" strokeWidth={2} />
            </span>
          </span>
        </span>
      </span>
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Link>
  );
}
