"use client";

import Link from "@/components/i18n/Link";
import { routes } from "@/config/routes";
import { useId } from "react";
import { ActionForm, useServerAction } from "@/components/ui/action-form";
import { describedBy } from "@/components/ui/field";
import { Turnstile } from "@/components/ui/turnstile";
import { subscribe } from "@/features/newsletter/actions";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { useFormErrors } from "@/lib/use-form-errors";
import { useTrackSuccess } from "@/features/conversions/use-track";

/**
 * Newsletter subscription (Server Action `subscribe`). Consent is explicit
 * (checkbox with a link to the policy), confirmation is double opt-in (Mailchimp sends
 * a verification e-mail) and `website` is a honeypot for bots: humans don't see the field.
 * The form can be on a page twice (/newsletter and the mobile menu), so ids come from useId.
 * `captcha` (decided on the server: both Turnstile keys set) adds the Turnstile widget.
 */
export default function NewsletterForm({ captcha }: { captcha: boolean }) {
  const t = useMessages();
  const id = useId();
  const [state, action, pending] = useServerAction(subscribe);
  const texts: Record<string, string> = t.newsletterForm.messages;
  // Unknown code (e.g. a generic validation error) → "the address doesn't look right".
  const text = (code: string) => texts[code] ?? texts.invalidEmail;
  const { form, hasFieldErrors, errorsOf } = useFormErrors(state, text);
  const errors = {
    email: errorsOf("email"),
    consent: errorsOf("consent"),
  };
  // Field errors stand under their field; the alert under the form carries the rest.
  const formError = state.error && !hasFieldErrors ? text(state.error) : null;
  const success = state.ok && state.message ? text(state.message) : null;
  useTrackSuccess(state, "newsletter_signup");
  const ids = {
    email: `${id}-email`,
    consent: `${id}-consent`,
  };

  return (
    <ActionForm ref={form} action={action} className="text-[13px]">
      <label htmlFor={ids.email} className="block font-medium">
        {t.newsletterForm.label}
      </label>

      <div className="mt-2 flex gap-2">
        <input
          id={ids.email}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={t.newsletterForm.placeholder}
          {...describedBy(ids.email, { errors: errors.email })}
          className="min-h-(--touch-min) min-w-0 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-[14px] text-white placeholder:text-white/40 focus:border-white/70 focus:ring-2 focus:ring-white/60 focus:outline-none aria-[invalid=true]:border-red-300"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-(--touch-min) shrink-0 rounded-lg bg-white px-4 text-[13px] font-medium whitespace-nowrap text-[var(--color-ink-deep)] transition hover:bg-white/85 disabled:opacity-60"
        >
          {pending ? t.common.sending : t.newsletter.signUp}
        </button>
      </div>
      <FieldError id={ids.email} errors={errors.email} />

      <label className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-white/60">
        <input
          id={ids.consent}
          type="checkbox"
          name="consent"
          required
          {...describedBy(ids.consent, { errors: errors.consent })}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          {t.newsletterForm.consent}{" "}
          <Link href={routes.privacy} className="underline">
            {t.newsletterForm.privacyLink}
          </Link>
          .
        </span>
      </label>
      <FieldError id={ids.consent} errors={errors.consent} />

      {captcha ? <Turnstile reset={state} theme="dark" className="mt-3" /> : null}

      {/* Honeypot for bots: a field invisible to humans. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      {formError ? (
        <p role="alert" className="mt-2.5 text-[12px] text-red-300">
          {formError}
        </p>
      ) : null}
      <p role="status" className="mt-2.5 text-[12px] text-emerald-300 empty:hidden">
        {success}
      </p>
    </ActionForm>
  );
}

/** Error under a field on the dark background (id matches describedBy). */
function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  return errors?.length ? (
    <p id={`${id}-error`} className="mt-1.5 text-[12px] text-red-300">
      {errors[0]}
    </p>
  ) : null;
}
