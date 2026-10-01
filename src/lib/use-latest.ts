"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Ref s poslední hodnotou pro obsluhy událostí, které vznikají jednou (např.
 * v efektu, který vytváří mapu). Zápis až po vykreslení — React Compiler
 * nedovolí sahat na ref během renderu.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
