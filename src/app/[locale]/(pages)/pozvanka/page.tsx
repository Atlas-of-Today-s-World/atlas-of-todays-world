import type { Metadata } from "next";
import { supabaseConfig } from "@/lib/supabase/config";
import GoogleSignIn from "../login/GoogleSignIn";

export const metadata: Metadata = {
  title: "Team invitation",
  robots: { index: false, follow: false },
};

/**
 * Stránka, na kterou vede odkaz z pozvánky. Nenese žádné tajemství — role se
 * přidělí podle ověřeného e-mailu při přihlášení (ARCHITEKTURA 7.3).
 */
export default function InvitationPage() {
  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">Invitation to the Atlas team</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Sign in with Google using <strong>the same email address</strong> the invitation was sent
        to. You&apos;ll get your team role automatically and the administration will open.
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
        The invitation is valid for 5 days. If it has expired or you sign in with a different
        address, ask the person who invited you for a new one.
      </p>
      <div className="mt-8">
        {supabaseConfig() ? (
          <GoogleSignIn next="/admin" />
        ) : (
          <p className="text-[13px] text-[var(--color-ink-muted)]">
            Sign-in isn&apos;t available yet.
          </p>
        )}
      </div>
    </main>
  );
}
