"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/field";
import { createBrowserClient } from "@/lib/supabase/browser";

/**
 * Two-factor authentication (TOTP) for roles that require it (E10). Those who
 * don't have it yet scan a QR code into an app (Google Authenticator, 1Password…);
 * those who do just type the six-digit code. The session then moves to aal2.
 */
export function MfaGate({ hasFactor }: { hasFactor: boolean }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<{ image: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    (async () => {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError("Couldn't load your authentication devices.");
      if (hasFactor) {
        setFactorId(factors.totp.find((f) => f.status === "verified")?.id ?? null);
        return;
      }
      // Delete unfinished enrollment attempts, otherwise a new one can't be created.
      for (const factor of factors.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Atlas ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError) return setError("Couldn't start authenticator app enrollment.");
      setFactorId(data.id);
      setQr({ image: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [hasFactor]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError("");
    const { error: verifyError } = await createBrowserClient().auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setError("The code doesn't match. Check the time on your phone and try the current code.");
      return;
    }
    router.refresh();
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
          <Button type="submit" disabled={busy || !factorId || code.length !== 6}>
            {busy ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </form>
    </main>
  );
}
