"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import Link from "@/components/i18n/Link";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { ActionForm } from "@/components/ui/action-form";
import { buttonVariants } from "@/components/ui/button";
import { describedBy, FormField, Input, RequiredNote, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/actions";
import { useFormErrors } from "@/lib/use-form-errors";
import { applyAsVolunteer } from "../actions";
import { topicPrefill } from "../prefill";

/**
 * Application to edit content as a volunteer (Server Action `applyAsVolunteer`).
 * Explicit consent with a link to the policy; `website` is a honeypot for bots.
 * Field errors (message codes) stand under their field and focus moves to the
 * first one; after sending, the form gives way to the thank-you note, which
 * takes the focus so it isn't lost with the vanished button.
 */
export function VolunteerForm() {
  const messages = useMessages();
  const t = messages.patrons.volunteer;
  const id = useId();
  const [state, action, pending] = useActionState<ActionState, FormData>(applyAsVolunteer, {
    ok: false,
  });
  const texts: Record<string, string> = t.messages;
  const text = (code: string) => texts[code] ?? texts.failed;
  const { form, hasFieldErrors, errorsOf } = useFormErrors(state, text);
  const topicsRef = useRef<HTMLInputElement>(null);
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const formError = state.error && !hasFieldErrors ? text(state.error) : null;

  // "Write a topic about X" links here with ?topic=X. Read on the client so the
  // page stays static; filled only into an empty field, never over typed text.
  useEffect(() => {
    const field = topicsRef.current;
    if (field && !field.value) field.value = topicPrefill(window.location.search);
  }, []);

  useEffect(() => {
    if (state.ok) thanksRef.current?.focus();
  }, [state.ok]);

  if (state.ok) {
    return (
      <p
        ref={thanksRef}
        role="status"
        tabIndex={-1}
        className="rounded-xl bg-[var(--color-success-soft)] p-5 text-[14px] text-[var(--color-success)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        {text(state.message ?? "thanks")}
      </p>
    );
  }

  const field = (name: string) => ({
    id: `${id}-${name}`,
    errors: errorsOf(name),
  });
  const name = field("name");
  const email = field("email");
  const topics = field("topics");
  const message = field("message");
  const consent = field("consent");

  return (
    <ActionForm ref={form} action={action} className="grid gap-4 sm:grid-cols-2">
      <RequiredNote label={t.requiredNote} className="sm:col-span-2" />
      <FormField {...name} label={t.name} required>
        <Input
          id={name.id}
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          {...describedBy(name.id, name)}
        />
      </FormField>
      <FormField {...email} label={t.email} required>
        <Input
          id={email.id}
          name="email"
          type="email"
          inputMode="email"
          required
          maxLength={254}
          autoComplete="email"
          {...describedBy(email.id, email)}
        />
      </FormField>
      <FormField {...topics} label={t.topics} className="sm:col-span-2">
        <Input
          ref={topicsRef}
          id={topics.id}
          name="topics"
          maxLength={300}
          placeholder={t.topicsHint}
          {...describedBy(topics.id, topics)}
        />
      </FormField>
      <FormField {...message} label={t.message} className="sm:col-span-2">
        <Textarea
          id={message.id}
          name="message"
          rows={4}
          maxLength={2000}
          {...describedBy(message.id, message)}
        />
      </FormField>
      <div className="sm:col-span-2">
        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
          <input
            id={consent.id}
            type="checkbox"
            name="consent"
            required
            className="mt-1 size-4 shrink-0"
            {...describedBy(consent.id, consent)}
          />
          <span>
            {t.consent}{" "}
            <Link href="/privacy" className="text-[var(--color-link)] underline">
              {t.privacyLink}
            </Link>
            .
            <span aria-hidden className="text-[var(--color-danger)]">
              {" "}
              *
            </span>
          </span>
        </label>
        {consent.errors ? (
          <p id={`${consent.id}-error`} className="mt-1.5 text-[12px] text-[var(--color-danger)]">
            {consent.errors[0]}
          </p>
        ) : null}
      </div>
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
          {pending ? messages.common.sending : t.submit}
        </button>
        {formError ? (
          <p role="alert" className="text-[13px] text-[var(--color-danger)]">
            {formError}
          </p>
        ) : null}
      </div>
    </ActionForm>
  );
}
