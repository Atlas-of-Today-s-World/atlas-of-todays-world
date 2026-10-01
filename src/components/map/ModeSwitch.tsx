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
 * Co se na globusu vybírá: státy, regiony Atlasu, nebo global issues.
 * Dokud návštěvník přepínač poprvé nepoužije, pulzuje u něj jiskra – jinak si
 * ho nikdo nevšimne. Po prvním kliknutí zhasne natrvalo.
 */
export default function ModeSwitch({
  hasIssues,
}: {
  /** Volbu „Issue" schováme, když redakce žádný global issue nemá. */
  hasIssues: boolean;
}) {
  const t = useMessages();
  const { mode, setMode } = useMapState();
  // Až po připojení (localStorage zná jen prohlížeč), ať server a klient
  // vykreslí stejné HTML.
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
      /* privátní režim – nevadí, jiskra se objeví znovu */
    }
  }

  return (
    <div className="relative">
      {hinting ? (
        <span aria-hidden className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7f97ff] opacity-80" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#3b4ce0] shadow-[0_0_10px_rgba(127,151,255,0.9)]" />
        </span>
      ) : null}

      <div
        role="radiogroup"
        aria-label={t.map.modes}
        className={`glass pointer-events-auto flex rounded-full p-0.5 text-[12.5px] transition ${
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
            className={`rounded-full px-3.5 py-1.5 whitespace-nowrap transition ${
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
