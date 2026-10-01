"use client";

import Script from "next/script";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/field";
import { useLocale, useMessages } from "@/components/i18n/LocaleProvider";
import { requestEmailCode, verifyEmailCode } from "@/features/auth/email-actions";
import { EMAIL_CODE_LENGTH, type EmailCodeState } from "@/features/auth/constants";
import { format } from "@/features/i18n/messages";
import { publicEnv } from "@/lib/env";

const TURNSTILE_KEY = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Sign-in with an e-mailed code (G1): e-mail → six-digit code → signed in.
 * The second step appears once the action returns the address the code was sent to.
 * Turnstile (only with a key in the environment) adds `cf-turnstile-response` to the form.
 */
export function EmailSignIn({ next }: { next: string }) {
  const t = useMessages().auth.email;
  const locale = useLocale();
  const [sent, request, requesting] = useActionState<EmailCodeState, FormData>(requestEmailCode, {
    ok: false,
  });
  const [checked, verify, verifying] = useActionState<EmailCodeState, FormData>(verifyEmailCode, {
    ok: false,
  });
  // "Use a different e-mail" returns the form to the first step (no new server request).
  const [restarted, setRestarted] = useState<EmailCodeState | null>(null);
  const email = sent.ok && sent !== restarted ? sent.email : undefined;
  const error = (email ? checked.error : sent.error) ?? null;
  const message = error ? format(t.errors[error], { length: String(EMAIL_CODE_LENGTH) }) : null;

  if (!email) {
    return (
      <form action={request} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="locale" value={locale} />
        <FormField id="login-email" label={t.label} required>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={sent.email}
          />
        </FormField>
        {TURNSTILE_KEY ? (
          <>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
            <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-language={locale} />
          </>
        ) : null}
        <Button type="submit" block disabled={requesting}>
          {requesting ? t.sending : t.send}
        </Button>
        <Status message={message} />
      </form>
    );
  }

  return (
    <form action={verify} className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={email} />
      <p role="status" className="text-[13.5px] text-[var(--color-ink-soft)]">
        {format(t.sentTo, { email, length: String(EMAIL_CODE_LENGTH) })}
      </p>
      <FormField id="login-code" label={t.codeLabel} required>
        <Input
          id="login-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${EMAIL_CODE_LENGTH}}`}
          maxLength={EMAIL_CODE_LENGTH}
          required
          autoFocus
        />
      </FormField>
      <Button type="submit" block disabled={verifying}>
        {verifying ? t.verifying : t.verify}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setRestarted(sent)}>
        {t.otherEmail}
      </Button>
      <Status message={message} />
    </form>
  );
}

function Status({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-[13px] text-red-700">
      {message}
    </p>
  ) : null;
}
