"use client";

import { Cookie } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { COOKIE_NOTICE_KEY, COOKIE_NOTICE_SECONDS } from "@/config/cookies";
import { format } from "@/features/i18n/messages";
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
 * (WCAG 2.2.1); once closed it doesn't come back in this browser.
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
  const [left, setLeft] = useState(COOKIE_NOTICE_SECONDS);
  const leftRef = useLatest(left);
  const visible = !closed && !(hydrated && seen());

  const close = useCallback(() => {
    setClosed(true);
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, "1");
    } catch {
      // Storage blocked: it simply shows again on the next visit.
    }
  }, []);

  useEffect(() => {
    // The countdown runs only in the browser, once we know the notice is new.
    if (!hydrated || !visible || paused) return;
    const tick = setInterval(() => setLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    const done = setTimeout(close, leftRef.current * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [hydrated, visible, paused, close, leftRef]);

  if (!visible) return null;

  return (
    <section
      aria-label={t.label}
      data-print="hide"
      data-cookie-notice=""
      // Painted before React takes over; this marks the moment the countdown runs.
      data-countdown={hydrated && !paused ? "running" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="glass fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md overflow-hidden rounded-2xl text-white shadow-2xl shadow-black/50"
    >
      <div className="flex items-start gap-3 p-4">
        <Cookie aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--color-gold)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-relaxed text-white/85">
            {t.text}{" "}
            <Link
              href={routes.privacy}
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
          className="min-h-11 shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 focus-visible:outline-none"
        >
          {t.ok}
        </button>
      </div>
      {/* Remaining time as a thin bar along the bottom edge. */}
      <div aria-hidden className="h-0.5 bg-white/10">
        <div
          className="h-full bg-[var(--color-gold)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${(left / COOKIE_NOTICE_SECONDS) * 100}%` }}
        />
      </div>
    </section>
  );
}
