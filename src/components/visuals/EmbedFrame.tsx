"use client";

import { useEffect, useRef, useState } from "react";
import { EMBED_PROVIDER_INFO, embedHeight, embedSrc, type EmbedProvider } from "@/lib/embeds";
import { cn } from "@/lib/cn";
import { useNearViewport } from "./use-near-viewport";

/**
 * One embedded chart or map (Datawrapper, Flourish, Our World in Data, World
 * Bank). `url` is a URL already checked on the server (lib/embeds.ts) and is
 * checked again here — only the allowlisted origins are ever framed, whatever
 * the database holds. The editors' pasted embed code is never rendered; this
 * iframe is ours.
 *
 * - Lazy: the iframe is created only when its place comes near the viewport
 *   (a carousel's hidden slides stay empty until shown) and then stays.
 * - Height: the editors' hint, else the provider's usual; Datawrapper and
 *   Flourish report their own height in a postMessage, accepted only from
 *   the provider's origin and this very frame.
 * - Sandbox: the chart may run its scripts, load its data from its own origin
 *   and open its source links in a new tab (outside the sandbox, so those
 *   pages work normally); it can't navigate our page, submit forms or download.
 *   `allow-same-origin` is safe because the frame's origin is never ours.
 */
export function EmbedFrame({
  provider,
  url,
  title,
  height: hint,
  openLabel,
  className,
}: {
  provider: EmbedProvider;
  url: string;
  title: string;
  /** Height hint in px (the editors'). */
  height?: number;
  /** Text of the fallback link while the frame isn't there (no JS, not loaded yet). */
  openLabel: string;
  className?: string;
}) {
  const info = EMBED_PROVIDER_INFO[provider];
  const src = embedSrc(provider, url);
  const [box, near] = useNearViewport<HTMLDivElement>();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(hint ?? info.height);

  useEffect(() => {
    if (!info.resizes || !near) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== info.origin || event.source !== frame.current?.contentWindow) return;
      const next = embedHeight(provider, event.data);
      if (next !== null) setHeight(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [info, near, provider]);

  if (!src) return null;
  return (
    <div
      ref={box}
      className={cn("w-full overflow-hidden rounded-xl bg-white", className)}
      style={{ height }}
    >
      {near ? (
        <iframe
          ref={frame}
          src={src}
          title={title}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          scrolling={info.resizes ? "no" : undefined}
          className="block h-full w-full border-0"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="grid h-full place-items-center text-[13px] text-[var(--color-link)] hover:underline"
        >
          {openLabel}
        </a>
      )}
    </div>
  );
}
