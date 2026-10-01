"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during server rendering and hydration, then true. For values only the
 * browser knows (localStorage, window size, language) — without setState in an
 * effect and without a server/client HTML mismatch.
 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
