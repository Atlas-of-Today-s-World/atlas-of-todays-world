"use client";

import EncyclopediaPanel from "./EncyclopediaPanel";

/**
 * Search over the map: just the search field, always there — on the home map
 * and over a profile, on desktop and mobile (no button to open it first).
 */
export default function EncyclopediaDock() {
  return (
    <div className="pointer-events-none flex flex-col items-end gap-2">
      <EncyclopediaPanel />
    </div>
  );
}
