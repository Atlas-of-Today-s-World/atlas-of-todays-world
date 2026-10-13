"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/field";
import { startMfaEnrollment, verifyMfaCode } from "@/features/auth/mfa-actions";

/**
 * Two-factor authentication (TOTP) for roles that require it (E10). Those who
 * don't have it yet scan a QR code into an app (Google Authenticator, 1Password…);
 * those who do just type the six-digit code. The session then moves to aal2.
 * Enrolment and verification are Server Actions — the page never holds the session.
 */
export function MfaGate({ hasFactor }: { hasFactor: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState<{ image: string; secret: string } | null>(null);
  const [ready, setReady] = useState(hasFactor);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, startVerify] = useTransition();

  useEffect(() => {
    if (hasFactor) return;
    let current = true;
    startMfaEnrollment().then(
      (result) => {
        if (!current) return;
        if (!result.ok) {
          setError("Couldn't start authenticator app enrollment.");
          return;
        }
        setQr({ image: result.qr, secret: result.secret });
        setReady(true);
      },
      () => current && setError("Couldn't start authenticator app enrollment."),
    );
    return () => {
      current = false;
    };
  }, [hasFactor]);

  function verify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startVerify(async () => {
      const result = await verifyMfaCode(code);
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(
        result.error === "code"
          ? "The code doesn't match. Check the time on your phone and try the current code."
          : "Couldn't verify the code. Reload the page and try again.",
      );
    });
  }

  return (
    <main className="mx-auto max-w-md py-12" data-testid="mfa-gate">
      <h1 className="font-display text-[26px] font-bold">Two-factor authentication</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        {hasFactor
          ? "Your role manages sensitive parts of the Atlas. Enter the six-digit code from your authenticator app."
          : "Your role manages sensitive parts of the Atlas, so it needs a second factor. Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy…) and enter the code it shows."}
      </p>
      {qr ? (
        <div className="mt-6 grid justify-items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.image} alt="QR code for the authenticator app" width={180} height={180} />
          <p className="text-[12px] text-[var(--color-ink-muted)]">
            Can’t scan it? Enter the key manually:{" "}
            <code className="break-all select-all">{qr.secret}</code>
          </p>
        </div>
      ) : null}
      <form onSubmit={verify} className="mt-6 grid gap-3">
        <FormField id="mfa-code" label="Code from the app" required>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
        </FormField>
        {error ? (
          <p role="alert" className="text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={busy || !ready || code.length !== 6}>
            {busy ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </form>
    </main>
  );
}
