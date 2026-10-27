"use client";

import { Cookie } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_SECONDS } from "@/config/cookies";
import { format } from "@/lib/i18n/messages";
import { useHydrated } from "@/lib/use-hydrated";
import { useLatest } from "@/lib/use-latest";
import { routes } from "@/config/routes";

const seen = () => {
  try {
    return localStorage.getItem(COOKIE_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Cookie notice on the first visit. The site sets only strictly necessary
 * cookies (sign-in session) and counts visits without cookies, so this is
 * information, not a consent request — which is why it may close by itself
 * after a visible countdown. Hovering or focusing it pauses the countdown
 * (WCAG 2.2.1), and so does CSS hiding it for a while (a phone's bottom sheet
 * pulled up to full height); once closed it doesn't come back in this browser.
 *
 * Rendered on the server, so it paints with the page (a notice appearing after
 * hydration became the page's late Largest Contentful Paint). Returning
 * visitors never see it: PrePaintScript marks <html> before the first paint
 * and globals.css hides it; after hydration it's dropped from the DOM.
 */
export function CookieNotice() {
  const t = useMessages().cookies;
  const hydrated = useHydrated();
  const [closed, setClosed] = useState(false);
  const [paused, setPaused] = useState(false);
  /** Hidden by CSS for a while (globals.css: a phone's sheet pulled up to full height). */
  const [aside, setAside] = useState(false);
  const [left, setLeft] = useState(COOKIE_NOTICE_SECONDS);
  const leftRef = useLatest(left);
  const notice = useRef<HTMLElement>(null);
  const visible = !closed && !(hydrated && seen());
  const counting = hydrated && visible && !paused && !aside;

  const close = useCallback(() => {
    setClosed(true);
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, "1");
    } catch {
      // Storage blocked: it simply shows again on the next visit.
    }
  }, []);

  // While CSS keeps the notice out of the way it isn't read, so its time waits:
  // a box that isn't rendered doesn't intersect the window.
  useEffect(() => {
    const element = notice.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setAside(!entry?.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    // The countdown runs only in the browser, once we know the notice is new.
    if (!counting) return;
    const tick = setInterval(() => setLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    const done = setTimeout(close, leftRef.current * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [counting, close, leftRef]);

  if (!visible) return null;

  return (
    <section
      ref={notice}
      aria-label={t.label}
      data-print="hide"
      data-cookie-notice=""
      // Painted before React takes over; this marks the moment the countdown runs.
      data-countdown={counting ? "running" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="glass z-notice fixed inset-x-4 bottom-4 mx-auto max-w-md overflow-hidden rounded-2xl text-white shadow-2xl shadow-black/50"
    >
      <div className="flex items-start gap-3 p-4">
        <Cookie aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--color-gold)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-relaxed text-white/85">
            {t.text}{" "}
            <Link
              href={routes.privacy}
              prefetchOnIntent
              className="font-medium text-white underline underline-offset-2 hover:text-[var(--color-gold-light)]"
            >
              {t.privacy}
            </Link>
          </p>
          <p aria-hidden className="mt-2 text-[11px] text-white/70 tabular-nums">
            {format(t.closesIn, { seconds: String(left) })}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="min-h-(--touch-min) shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 focus-visible:outline-none"
        >
          {t.ok}
        </button>
      </div>
      {/* Remaining time as a thin bar along the bottom edge. Shrunk with a transform,
          not its width: the compositor animates it without a layout on every frame. */}
      <div aria-hidden className="h-0.5 bg-white/10">
        <div
          className="h-full origin-left bg-[var(--color-gold)] transition-transform duration-1000 ease-linear"
          style={{ transform: `scaleX(${left / COOKIE_NOTICE_SECONDS})` }}
        />
      </div>
    </section>
  );
}
