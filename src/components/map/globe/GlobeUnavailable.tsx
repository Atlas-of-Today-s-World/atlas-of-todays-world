"use client";

import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/cn";

/**
 * MapLibre failed to load or the browser has no WebGL: a message with the way
 * to the country list replaces the globe. The live region is always in the DOM,
 * so screen readers announce the message when it appears (`show`).
 */
export function GlobeUnavailable({ show }: { show: boolean }) {
  const t = useMessages();
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex items-center justify-center p-4"
    >
      {show ? (
        <div className="glass pointer-events-auto max-w-md rounded-3xl px-6 py-5 text-center text-white">
          <p className="font-display text-[18px] font-bold">{t.map.globeUnavailable}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/80">
            {t.map.globeUnavailableText}
          </p>
          <Link href={routes.countries} className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
            {t.map.globeUnavailableLink}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
