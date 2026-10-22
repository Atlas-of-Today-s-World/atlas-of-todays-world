"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * An opened subtopic starts with its Overview box; the whole text waits under
 * "Full Reading". The text is in the HTML all along (search engines, find in
 * page once open) — this only shows it. A link to something inside it
 * (`#note-3`) opens it too.
 */
export function FullReading({
  overview,
  label,
  children,
}: {
  /** Contents of the Overview box (its pill, the key points, the audio). */
  overview: ReactNode;
  /** The button's text ("Full Reading"). */
  label: string;
  /** The subtopic's whole text. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const textId = useId();

  useEffect(() => {
    const openOnHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? textRef.current?.querySelector(`#${CSS.escape(id)}`) : null;
      if (!target) return;
      setOpen(true);
      // After the text shows: only then does the target have a place to scroll to.
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    openOnHash();
    window.addEventListener("hashchange", openOnHash);
    return () => window.removeEventListener("hashchange", openOnHash);
  }, []);

  return (
    <>
      <div className="mt-5 rounded-2xl bg-[var(--color-line)]/25 p-5 sm:p-6">
        {overview}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen((value) => !value)}
          className="mt-5 inline-flex min-h-(--touch-min) items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {label}
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <div id={textId} ref={textRef} hidden={!open}>
        {children}
      </div>
    </>
  );
}
