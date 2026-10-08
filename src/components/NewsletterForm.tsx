"use client";

import Link from "@/components/i18n/Link";
import { routes } from "@/config/routes";
import { useActionState, useId } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { describedBy } from "@/components/ui/field";
import { subscribe } from "@/features/newsletter/actions";
import { NEWSLETTER_INTERESTS } from "@/features/newsletter/schema";
import type { ActionState } from "@/lib/actions";
import { useMessages } from "@/components/i18n/LocaleProvider";
import { useFormErrors } from "@/lib/use-form-errors";

/**
 * Newsletter subscription (Server Action `subscribe`). Consent is explicit
 * (checkbox with a link to the policy), confirmation is double opt-in (Mailchimp sends
 * a verification e-mail) and `website` is a honeypot for bots: humans don't see the field.
 * The form can be on a page twice (/newsletter and the mobile menu), so ids come from useId.
 */
export default function NewsletterForm() {
  const t = useMessages();
  const id = useId();
  const [state, action, pending] = useActionState<ActionState, FormData>(subscribe, {
    ok: false,
  });
  const texts: Record<string, string> = t.newsletterForm.messages;
  // Unknown code (e.g. a generic validation error) → "the address doesn't look right".
  const text = (code: string) => texts[code] ?? texts.invalidEmail;
  const { form, hasFieldErrors, errorsOf } = useFormErrors(state, text);
  const errors = {
    email: errorsOf("email"),
    interests: errorsOf("interests"),
    consent: errorsOf("consent"),
  };
  // Field errors stand under their field; the alert under the form carries the rest.
  const formError = state.error && !hasFieldErrors ? text(state.error) : null;
  const success = state.ok && state.message ? text(state.message) : null;
  const ids = {
    email: `${id}-email`,
    interests: `${id}-interests`,
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
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-[14px] text-white placeholder:text-white/40 focus:border-white/70 focus:ring-2 focus:ring-white/60 focus:outline-none aria-[invalid=true]:border-red-300"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 shrink-0 rounded-lg bg-white px-4 text-[13px] font-medium whitespace-nowrap text-[#0d1324] transition hover:bg-white/85 disabled:opacity-60"
        >
          {pending ? t.common.sending : t.newsletter.signUp}
        </button>
      </div>
      <FieldError id={ids.email} errors={errors.email} />

      {/* What to receive: new content by default, organisation news on request. */}
      <fieldset
        className="mt-3"
        aria-describedby={errors.interests ? `${ids.interests}-error` : undefined}
      >
        <legend className="text-[11.5px] font-medium text-white/75">
          {t.newsletterForm.interestsLabel}
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {NEWSLETTER_INTERESTS.map((interest) => (
            <label
              key={interest}
              className="flex min-h-8 items-center gap-2 text-[12px] text-white/80"
            >
              <input
                type="checkbox"
                name="interests"
                value={interest}
                defaultChecked={interest === "topics"}
                aria-invalid={errors.interests ? true : undefined}
                className="h-4 w-4 shrink-0"
              />
              {t.newsletterForm.interests[interest]}
            </label>
          ))}
        </div>
        <FieldError id={ids.interests} errors={errors.interests} />
      </fieldset>

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
