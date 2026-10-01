"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Ref holding the latest value for event handlers created once (e.g. in an
 * effect that creates the map). Written only after render — React Compiler
 * doesn't allow touching a ref during render.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
