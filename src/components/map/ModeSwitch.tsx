"use client";

import { useEffect, useState } from "react";
import { useMapState, type SelectionMode } from "./MapContext";

const OPTIONS: { id: SelectionMode; label: string }[] = [
  { id: "countries", label: "Countries" },
  { id: "regions", label: "Regions" },
];

const SEEN_KEY = "atlas.modeSwitchSeen";

/**
 * Přepínač, jestli se na globusu vybírají jednotlivé státy, nebo rovnou celé
 * regiony Atlasu. Dokud ho uživatel poprvé nepoužije, pulzuje u něj jiskra –
 * jinak si přepínače nikdo nevšimne. Po prvním kliknutí zhasne natrvalo.
 */
export default function ModeSwitch() {
  const { mode, setMode } = useMapState();
  const [hinting, setHinting] = useState(false);

  // Až po připojení, aby se server a klient neshodly na jiném HTML.
  useEffect(() => {
    try {
      setHinting(localStorage.getItem(SEEN_KEY) !== "1");
    } catch {
      setHinting(true);
    }
  }, []);

  function choose(next: SelectionMode) {
    setMode(next);
    setHinting(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* privátní režim – nevadí, jiskra se objeví znovu */
    }
  }

  return (
    <div className="relative">
      {hinting ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1 -top-1 flex h-3 w-3"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7f97ff] opacity-80" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#3b4ce0] shadow-[0_0_10px_rgba(127,151,255,0.9)]" />
        </span>
      ) : null}

      <div
        role="radiogroup"
        aria-label="Map selection mode"
        className={`glass pointer-events-auto flex rounded-full p-0.5 text-[12.5px] transition ${
          hinting ? "ring-1 ring-[#7f97ff]/50" : ""
        }`}
      >
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            onClick={() => choose(option.id)}
            className={`rounded-full px-3.5 py-1.5 transition ${
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
