"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { publicEnv } from "@/lib/env";

const SITE_KEY = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
/** Explicit rendering: the widget is drawn on mount, also in forms that appear later (menu, second step). */
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** The part of Cloudflare's `window.turnstile` used here. */
interface TurnstileApi {
  render(
    container: HTMLElement,
    options: { sitekey: string; language?: string; theme?: "auto" | "light" | "dark" },
  ): string | undefined;
  reset(widget: string): void;
  remove(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile widget (CSP: lib/security/csp.ts). It adds the hidden
 * field `cf-turnstile-response` to the surrounding form; the server checks it
 * (lib/security/turnstile.ts for public forms, Supabase Auth for e-mail sign-in).
 * Renders nothing without a site key. A token is single-use, so pass the form's
 * action state as `reset`: every new answer from the server gets a fresh token.
 */
export function Turnstile({
  reset,
  theme = "auto",
  className,
}: {
  /** A new value (e.g. the action state after a submit) renews the token. */
  reset?: unknown;
  theme?: "auto" | "light" | "dark";
  className?: string;
}) {
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const lastReset = useRef(reset);

  // Called on load and on every mount once loaded; draws the widget only once.
  const draw = () => {
    if (!SITE_KEY || !box.current || widget.current || !window.turnstile) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      language: locale,
      theme,
    });
  };

  useEffect(() => {
    if (lastReset.current === reset) return;
    lastReset.current = reset;
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [reset]);

  useEffect(
    () => () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    },
    [],
  );

  if (!SITE_KEY) return null;
  return (
    <>
      <Script src={SCRIPT} onLoad={draw} onReady={draw} />
      <div ref={box} className={className} />
    </>
  );
}
