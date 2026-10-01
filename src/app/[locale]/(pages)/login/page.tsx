import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeRedirect } from "@/lib/security/redirect";
import { supabaseConfig } from "@/lib/supabase/config";
import { currentUser } from "@/lib/supabase/server";
import GoogleSignIn from "./GoogleSignIn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  callback: "Sign-in did not finish. Please try again.",
  config: "Sign-in is not available on this deployment yet.",
};

/**
 * Přihlášení (ARCHITEKTURA 7.1): Google hned, e-mailový kód až s vlastním SMTP.
 * Čtenář se tím zároveň zaregistruje; do redakce se vstupuje pozvánkou.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeRedirect(next, "/ucet");
  const configured = supabaseConfig() !== null;

  if (configured && (await currentUser())) redirect(target);

  return (
    <main className="mx-auto max-w-md">
      <h1 className="font-display text-[28px] font-bold">Sign in</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
        Readers can create an account in one click. Members of the Atlas team use the same e-mail
        address their invitation was sent to.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {ERRORS[error] ?? ERRORS.callback}
        </p>
      ) : null}

      <div className="mt-8">
        {configured ? (
          <GoogleSignIn next={target} />
        ) : (
          <p className="text-[13px] text-[var(--color-ink-muted)]">{ERRORS.config}</p>
        )}
      </div>

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--color-ink-muted)]">
        We only use your name and e-mail address to run your account. Signing in with an e-mail code
        will be available soon.
      </p>
    </main>
  );
}
