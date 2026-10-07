"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { ActionForm } from "@/components/ui/action-form";
import { buttonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { applyAsVolunteer } from "../actions";
import { topicPrefill } from "../prefill";

const FIELD =
  "min-h-11 w-full rounded-lg border border-[var(--color-field-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none";
const LABEL = "block text-[13px] font-medium text-[var(--color-ink)]";

/**
 * Application to edit content as a volunteer (Server Action `applyAsVolunteer`).
 * Explicit consent with a link to the policy; `website` is a honeypot for bots.
 * After sending, the form gives way to the thank-you note.
 */
export function VolunteerForm() {
  const t = useMessages().patrons.volunteer;
  const [state, action, pending] = useActionState<ActionState, FormData>(applyAsVolunteer, {
    ok: false,
  });
  const texts: Record<string, string> = t.messages;
  const code = state.error ?? state.message;
  const message = code ? (texts[code] ?? texts.failed) : null;
  const topicsRef = useRef<HTMLInputElement>(null);

  // "Write a topic about X" links here with ?topic=X. Read on the client so the
  // page stays static; filled only into an empty field, never over typed text.
  useEffect(() => {
    const field = topicsRef.current;
    if (field && !field.value) field.value = topicPrefill(window.location.search);
  }, []);

  if (state.ok) {
    return (
      <p
        role="status"
        className="rounded-xl bg-[var(--color-success-soft)] p-5 text-[14px] text-[var(--color-success)]"
      >
        {message}
      </p>
    );
  }

  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="volunteer-name" className={LABEL}>
          {t.name}
        </label>
        <input
          id="volunteer-name"
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          className={cn(FIELD, "mt-1.5")}
        />
      </div>
      <div>
        <label htmlFor="volunteer-email" className={LABEL}>
          {t.email}
        </label>
        <input
          id="volunteer-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          className={cn(FIELD, "mt-1.5")}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="volunteer-topics" className={LABEL}>
          {t.topics}
        </label>
        <input
          ref={topicsRef}
          id="volunteer-topics"
          name="topics"
          maxLength={300}
          placeholder={t.topicsHint}
          className={cn(FIELD, "mt-1.5")}
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="volunteer-message" className={LABEL}>
          {t.message}
        </label>
        <textarea
          id="volunteer-message"
          name="message"
          rows={4}
          maxLength={2000}
          className={cn(FIELD, "mt-1.5 py-2.5")}
        />
      </div>
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--color-ink-soft)] sm:col-span-2">
        <input
          id="volunteer-consent"
          type="checkbox"
          name="consent"
          required
          className="mt-1 size-4 shrink-0"
        />
        <span>
          {t.consent}{" "}
          <Link href="/privacy" className="text-[var(--color-link)] underline">
            {t.privacyLink}
          </Link>
          .
        </span>
      </label>
      {/* Honeypot for bots: a field invisible to humans. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonVariants({ size: "md" })}>
          {pending ? "…" : t.submit}
        </button>
        {message ? (
          <p role="status" className="text-[13px] text-[var(--color-danger)]">
            {message}
          </p>
        ) : null}
      </div>
    </ActionForm>
  );
}
