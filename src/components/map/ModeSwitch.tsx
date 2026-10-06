"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { useMapState, type SelectionMode } from "./MapContext";
import { useMessages } from "@/components/i18n/LocaleProvider";

const SEEN_KEY = "atlas.modeSwitchSeen";

function seenBefore() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * What the globe selects: countries, Atlas regions, or global issues.
 * Until the visitor uses the switcher for the first time, a sparkle pulses next to it –
 * otherwise nobody would notice it. After the first click it goes out for good.
 */
export default function ModeSwitch({
  hasIssues,
}: {
  /** We hide the "Issue" option when the editors have no global issue. */
  hasIssues: boolean;
}) {
  const t = useMessages();
  const { mode, setMode } = useMapState();
  // Only after mount (only the browser knows localStorage), so server and client
  // render the same HTML.
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);
  const hinting = hydrated && !dismissed && !seenBefore();

  const options: { id: SelectionMode; label: string }[] = [
    { id: "countries", label: t.map.modeCountries },
    { id: "regions", label: t.map.modeRegions },
    ...(hasIssues ? [{ id: "issue" as const, label: t.map.modeIssues }] : []),
  ];

  function choose(next: SelectionMode) {
    setMode(next);
    setDismissed(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode – never mind, the sparkle will show again */
    }
  }

  return (
    <div className="relative min-w-0 flex-1 sm:flex-none">
      {hinting ? (
        <span aria-hidden className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7f97ff] opacity-80" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#3b4ce0] shadow-[0_0_10px_rgba(127,151,255,0.9)]" />
        </span>
      ) : null}

      <div
        role="radiogroup"
        aria-label={t.map.modes}
        className={`glass pointer-events-auto flex rounded-full p-0.5 text-[12px] transition sm:text-[12.5px] ${
          hinting ? "ring-1 ring-[#7f97ff]/50" : ""
        }`}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            onClick={() => choose(option.id)}
            // On phones the three share the row evenly.
            className={`min-h-9 flex-1 rounded-full px-2 py-1.5 whitespace-nowrap transition sm:min-h-0 sm:flex-none sm:px-3.5 ${
              mode === option.id
                ? "bg-white font-medium text-[#0d1324]"
                : "text-white/75 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
