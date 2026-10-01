"use client";

import Link from "@/components/i18n/Link";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { subscribe } from "@/features/newsletter/actions";
import type { ActionState } from "@/lib/actions";
import { useMessages } from "@/components/i18n/LocaleProvider";

/**
 * Newsletter subscription (Server Action `subscribe`). Consent is explicit
 * (checkbox with a link to the policy), confirmation is double opt-in (Mailchimp sends
 * a verification e-mail) and `website` is a honeypot for bots: humans don't see the field.
 */
export default function NewsletterForm() {
  const t = useMessages();
  const [state, action, pending] = useActionState<ActionState, FormData>(subscribe, {
    ok: false,
  });
  const code = state.error ?? state.message;
  const texts: Record<string, string> = t.newsletterForm.messages;
  // Unknown code (e.g. a generic validation error) → "the address doesn't look right".
  const message = code ? (texts[code] ?? texts.invalidEmail) : null;

  return (
    <ActionForm action={action} className="text-[13px]">
      <label htmlFor="newsletter-email" className="block font-medium">
        {t.newsletterForm.label}
      </label>

      <div className="mt-2 flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.newsletterForm.placeholder}
          className="min-h-11 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-[14px] text-white placeholder:text-white/40 focus:border-white/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-white px-4 text-[13px] font-medium text-[#0d1324] transition hover:bg-white/85 disabled:opacity-60"
        >
          {pending ? "…" : t.newsletter.signUp}
        </button>
      </div>

      <label className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-white/60">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t.newsletterForm.consent}{" "}
          <Link href="/privacy" className="underline">
            {t.newsletterForm.privacyLink}
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

      {message ? (
        <p
          role="status"
          className={`mt-2.5 text-[12px] ${state.error ? "text-red-300" : "text-emerald-300"}`}
        >
          {message}
        </p>
      ) : null}
    </ActionForm>
  );
}
