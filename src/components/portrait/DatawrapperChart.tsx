"use client";

import { useEffect, useRef, useState } from "react";
import { DATAWRAPPER_ORIGIN, datawrapperHeight } from "@/lib/embeds";

/** Height before the chart reports its own — a typical Datawrapper chart. */
const DEFAULT_HEIGHT = 400;

/**
 * One interactive Datawrapper chart in the portrait carousel. `src` is a chart
 * URL already checked on the server (lib/embeds.ts) — the editors' pasted embed
 * code is never rendered; this iframe is ours.
 *
 * Instead of Datawrapper's resizer script we listen for its height message
 * ourselves, and only from the chart's origin and this very frame. The sandbox
 * lets the chart run its scripts and load its data from its own origin, and
 * open source links in a new tab; it can't navigate our page or submit forms.
 * `allow-same-origin` is safe here because the frame's origin is never ours.
 */
export function DatawrapperChart({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== DATAWRAPPER_ORIGIN || event.source !== ref.current?.contentWindow)
        return;
      const next = datawrapperHeight(event.data);
      if (next !== null) setHeight(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="strict-origin-when-cross-origin"
      scrolling="no"
      className="block w-full overflow-hidden rounded-xl border-0 bg-white"
      style={{ height }}
    />
  );
}
