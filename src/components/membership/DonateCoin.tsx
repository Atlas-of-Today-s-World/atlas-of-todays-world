import { Globe, Heart } from "lucide-react";
import Link from "@/components/i18n/Link";
import { MEMBERSHIP_PATH } from "@/features/membership/config";
import { cn } from "@/lib/cn";

/** Edge discs between the two faces: they give the turning coin its thickness. */
const EDGE = [-1, -0.5, 0, 0.5, 1];

/**
 * Small glass button with a slowly turning gold coin, linking to the Atlas
 * Patrons donation page. On narrow screens only the coin shows (the label
 * stays for screen readers). The pill is 35 px tall; an invisible margin keeps
 * the 44 px touch target.
 */
export function DonateCoin({ label, className }: { label: string; className?: string }) {
  return (
    <Link
      href={MEMBERSHIP_PATH}
      data-print="hide"
      className={cn(
        "glass glass-hover group pointer-events-auto flex h-[35px] min-w-[35px] items-center gap-2 rounded-full px-[4.5px] text-[11px] font-medium text-white transition sm:pr-[13px]",
        "before:absolute before:-inset-[4.5px] before:rounded-full before:content-['']",
        "hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)]",
        className,
      )}
    >
      <span aria-hidden className="relative grid size-[26px] shrink-0 place-items-center">
        <span className="absolute -inset-[5px] animate-[coin-glow_3s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(232,181,58,0.55),transparent_70%)] transition-opacity group-hover:opacity-100" />
        <span className="relative size-[26px] [perspective:130px]">
          <span className="relative block size-full animate-[coin-spin_5s_cubic-bezier(0.45,0.05,0.35,1)_infinite] [transform-style:preserve-3d]">
            {EDGE.map((z) => (
              <span
                key={z}
                className="absolute inset-0 rounded-full bg-[var(--color-gold-edge)]"
                style={{ transform: `translateZ(${z}px)` }}
              />
            ))}
            <span className="coin-face absolute inset-0 grid [transform:translateZ(1px)] place-items-center rounded-full [backface-visibility:hidden]">
              <Globe className="size-[13px] text-[var(--color-gold-edge)]" strokeWidth={2} />
            </span>
            <span className="coin-face absolute inset-0 grid [transform:rotateY(180deg)_translateZ(1px)] place-items-center rounded-full [backface-visibility:hidden]">
              <Heart className="size-[13px] text-[var(--color-gold-edge)]" strokeWidth={2} />
            </span>
          </span>
        </span>
      </span>
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Link>
  );
}
