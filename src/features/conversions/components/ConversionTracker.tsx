"use client";

import { useEffect } from "react";
import {
  CONVERSION_EVENTS,
  TRACK_ATTRIBUTE,
  aiReferrerGroup,
  type ConversionEvent,
} from "../events";
import { rememberAiReferrer, track } from "../track";

const isEvent = (value: string | undefined): value is ConversionEvent =>
  value !== undefined && (CONVERSION_EVENTS as readonly string[]).includes(value);

/**
 * Once per page load in the public layout (renders nothing):
 * - a landing referred by an AI assistant counts one `ai_referral` (once per
 *   tab session) and later events of the session carry the assistant's name;
 * - a click on any element with `data-track="<event>"` counts that event, so
 *   server components (the "Write a topic" links) need no client code of
 *   their own.
 */
export function ConversionTracker() {
  useEffect(() => {
    const group = aiReferrerGroup(document.referrer, window.location.search);
    if (group && rememberAiReferrer(group)) track("ai_referral");

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>(`[${TRACK_ATTRIBUTE}]`);
      const name = element?.getAttribute(TRACK_ATTRIBUTE) ?? undefined;
      if (isEvent(name)) track(name);
    };
    // Capture: counted before the link navigates, whatever stops the event later.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
