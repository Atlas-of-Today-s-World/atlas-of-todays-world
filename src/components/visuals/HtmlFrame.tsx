"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  VISUAL_HTML_HEIGHT,
  VISUAL_HTML_SANDBOX,
  visualHtmlHeight,
  visualHtmlSrc,
} from "@/lib/visual-html";
import { useNearViewport } from "./use-near-viewport";

/**
 * An editor's custom code from Maps & charts (ADR-032), framed from
 * /api/visual-html/<id>. The document there is sandboxed by its own CSP and
 * by this frame's `sandbox` without allow-same-origin: its scripts run in an
 * opaque origin, apart from our page, cookies and storage (lib/visual-html.ts).
 *
 * - Lazy like EmbedFrame: created when its place comes near the viewport.
 * - Height: the editors' hint fixes it (the code scrolls inside); without one
 *   the frame follows the height the document reports, accepted only from
 *   this very frame.
 */
export function HtmlFrame({
  id,
  title,
  height: hint,
  version,
  className,
}: {
  /** The visual's id. */
  id: string;
  title: string;
  /** Height in px (the editors'); none = the code's own. */
  height?: number;
  /** Changes the address after a save (the admin's preview), so no old copy shows. */
  version?: string;
  className?: string;
}) {
  const [box, near] = useNearViewport<HTMLDivElement>();
  const frame = useRef<HTMLIFrameElement>(null);
  const [measured, setMeasured] = useState<number>(VISUAL_HTML_HEIGHT.initial);
  const src = version ? `${visualHtmlSrc(id)}?v=${encodeURIComponent(version)}` : visualHtmlSrc(id);

  useEffect(() => {
    if (hint || !near) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const next = visualHtmlHeight(event.origin, event.data);
      if (next !== null) setMeasured(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [hint, near]);

  return (
    <div
      ref={box}
      className={cn("w-full overflow-hidden rounded-xl bg-white", className)}
      style={{ height: hint ?? measured }}
    >
      {near ? (
        <iframe
          ref={frame}
          src={src}
          title={title}
          loading="lazy"
          sandbox={VISUAL_HTML_SANDBOX}
          allow="fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          scrolling={hint ? undefined : "no"}
          className="block h-full w-full border-0"
        />
      ) : null}
    </div>
  );
}
