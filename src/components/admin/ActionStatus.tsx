"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions";

/**
 * Form submission result: error (alert) or confirmation (status), placed right
 * above the form's submit button. After a failed save the focus moves to the
 * first invalid field (keyboard and screen-reader users land on what to fix);
 * otherwise the message itself is scrolled into view, so the result of a long
 * form is never off-screen.
 */
export function ActionStatus({ state, success }: { state: ActionState; success?: string }) {
  const box = useRef<HTMLParagraphElement>(null);
  const message = state.error || (state.ok ? state.message || success : undefined);

  useEffect(() => {
    if (!message) return;
    const invalid = state.error
      ? box.current?.closest("form")?.querySelector<HTMLElement>('[aria-invalid="true"]')
      : null;
    if (invalid) invalid.focus();
    else box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // A new result object = a new submission, even with the same text.
  }, [state, message]);

  if (state.error) {
    return (
      <p
        ref={box}
        role="alert"
        className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (message) {
    return (
      <p
        ref={box}
        role="status"
        className="rounded-lg bg-[var(--color-success-soft)] px-3 py-2 text-[13px] text-[var(--color-success)]"
      >
        {message}
      </p>
    );
  }
  return null;
}
