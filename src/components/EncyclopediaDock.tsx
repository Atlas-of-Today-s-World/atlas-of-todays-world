"use client";

import EncyclopediaPanel from "./EncyclopediaPanel";

/**
 * Search over the map: just the search field, always there — on the home map
 * and over a profile, on desktop and mobile (no button to open it first).
 */
export default function EncyclopediaDock() {
  return (
    // max-w-full: never wider than the controls bar (between zoom and panel).
    <div className="pointer-events-none flex max-w-full flex-col items-end gap-2">
      <EncyclopediaPanel />
    </div>
  );
}
