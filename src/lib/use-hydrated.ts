"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false při vykreslení na serveru a při hydrataci, pak true. Pro hodnoty, které
 * zná jen prohlížeč (localStorage, velikost okna, jazyk) — bez setState v
 * efektu a bez nesouladu HTML serveru a klienta.
 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
