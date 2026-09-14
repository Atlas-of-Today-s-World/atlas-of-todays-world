"use client";

import { useMapState, type SelectionMode } from "./MapContext";

const OPTIONS: { id: SelectionMode; label: string }[] = [
  { id: "countries", label: "Countries" },
  { id: "regions", label: "Regions" },
];

/**
 * Přepínač, jestli se na globusu vybírají jednotlivé státy, nebo rovnou celé
 * regiony Atlasu (ty barevné celky). Mění zvýraznění, popisky i cíl kliknutí.
 */
export default function ModeSwitch() {
  const { mode, setMode } = useMapState();

  return (
    <div
      role="radiogroup"
      aria-label="Map selection mode"
      className="glass pointer-events-auto flex rounded-full p-0.5 text-[12.5px]"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={mode === option.id}
          onClick={() => setMode(option.id)}
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
  );
}
