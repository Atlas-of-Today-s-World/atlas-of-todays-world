"use client";

import { useRef, type ComponentProps } from "react";
import { useScrollMemory } from "@/lib/use-scroll-memory";

/**
 * A `<div>` that scrolls on its own and remembers how far, per address, so
 * Back returns to the same spot (useScrollMemory). The client edge for
 * server-rendered frames such as FullPage.
 */
export function RememberedScroll(props: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollMemory(ref);
  return <div ref={ref} {...props} />;
}
