"use client";

import { Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** How long the "Link copied" note stays next to the button. */
const FEEDBACK_MS = 2_000;

type Status = "idle" | "copied" | "failed";

/** The page address without the query (and with the given part of the page, if any). */
const pageUrl = (hash?: string) =>
  `${window.location.origin}${window.location.pathname}${hash ? `#${hash}` : ""}`;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * "Share" on a country, region, global issue or topic page. Phones get the
 * system share sheet (Web Share API); elsewhere the link is copied and a short
 * note, announced to screen readers, confirms it. `hash` shares one part of
 * the page (a subtopic) rather than its top.
 */
export function ShareButton({
  title,
  hash,
  className,
}: {
  title: string;
  hash?: string;
  className?: string;
}) {
  const t = useMessages().share;
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const reset = setTimeout(() => setStatus("idle"), FEEDBACK_MS);
    return () => clearTimeout(reset);
  }, [status]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  const share = async () => {
    const url = pageUrl(hash);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The reader closed the share sheet: nothing to say.
        if (isAbort(error)) return;
        // Share refused (e.g. not allowed in this frame): copying still helps.
      }
    }
    await copy(url);
  };

  return (
    <span data-print="hide" className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <Button variant="outline" size="sm" onClick={share}>
        {status === "copied" ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Share2 aria-hidden className="size-4" />
        )}
        {t.share}
      </Button>
      {/* Always in the DOM, so screen readers pick up the change. */}
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "text-[12px] font-medium",
          status === "failed" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-muted)]",
        )}
      >
        {status === "copied" ? t.copied : status === "failed" ? t.copyFailed : null}
      </span>
    </span>
  );
}
