"use client";

import { useEffect } from "react";
import type { ConversionEvent } from "./events";
import { track } from "./track";

/** Counts `event` once for each successful answer of a form's Server Action. */
export function useTrackSuccess(state: { ok: boolean }, event: ConversionEvent) {
  useEffect(() => {
    if (state.ok) track(event);
  }, [state, event]);
}

/** Counts `event` once when the page it is on loads (e.g. the thank-you page). */
export function TrackOnLoad({ event }: { event: ConversionEvent }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
