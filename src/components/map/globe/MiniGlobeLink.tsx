"use client";

import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { routes } from "@/config/routes";

/** Over the corner window on full-width pages: the whole window leads back to the Atlas. */
export function MiniGlobeLink() {
  const t = useMessages();
  return (
    <Link
      href={routes.home}
      aria-label={t.topics.globeWindow}
      className="group absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-gradient-to-b from-black/55 via-transparent to-transparent p-2.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="rounded-full bg-black/55 px-3.5 py-[5px] text-[13px] font-medium text-white backdrop-blur transition group-hover:bg-black/75">
        {t.topics.backToAtlas}
      </span>
    </Link>
  );
}
