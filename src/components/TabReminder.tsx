"use client";

import { useEffect } from "react";
import { useMessages } from "@/components/i18n/LocaleProvider";

/** One pulse of the favicon: lit, then plain (background tabs run timers at most once a second). */
const PULSE_MS = 1000;
/** Size the alternate favicon is drawn at (crisp on 2× screens). */
const ICON_PX = 64;

/** Draws the site icon with a red glowing dot in the corner — the "lit" frame. */
async function litIcon(href: string): Promise<string | null> {
  try {
    const image = new Image();
    image.src = href;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ICON_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, ICON_PX, ICON_PX);
    const [x, y, r] = [ICON_PX - 15, 15, 12];
    ctx.shadowColor = "rgba(239, 68, 68, 0.9)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * While the visitor is on another browser tab, the Atlas tab asks them back:
 * the title changes to "Come back, we need you" (from the messages, so it
 * follows the language) and the favicon pulses with a red dot. Both are
 * restored the moment the tab is visible again. Nothing is shown to screen
 * readers or stored; with reduced motion the favicon stays still.
 */
export function TabReminder() {
  const t = useMessages().tab;

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const plainIcon = link?.href ?? null;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lit: string | null = null;
    let savedTitle: string | null = null;
    let timer = 0;

    if (plainIcon && !still) void litIcon(plainIcon).then((url) => (lit = url));

    const away = () => {
      savedTitle = document.title;
      document.title = t.comeBack;
      if (!link || !plainIcon || !lit) return;
      let on = false;
      timer = window.setInterval(() => {
        on = !on;
        link.href = on && lit ? lit : plainIcon;
      }, PULSE_MS);
    };
    const back = () => {
      window.clearInterval(timer);
      if (link && plainIcon) link.href = plainIcon;
      // Only undo our own title; a navigation meanwhile may have set a new one.
      if (savedTitle !== null && document.title === t.comeBack) document.title = savedTitle;
      savedTitle = null;
    };
    const onChange = () => (document.hidden ? away() : back());

    document.addEventListener("visibilitychange", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
      back();
    };
  }, [t.comeBack]);

  return null;
}
