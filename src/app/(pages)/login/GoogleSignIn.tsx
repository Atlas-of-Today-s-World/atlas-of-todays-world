"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";
import { safeRedirect } from "@/lib/security/redirect";

/** Přesměruje na Google (PKCE); návrat zpracuje /auth/callback. */
export default function GoogleSignIn({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true);
    setError("");
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", safeRedirect(next, "/ucet"));
    const { error: failure } = await createBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (failure) {
      setError("Could not reach Google. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-[var(--color-line)] bg-white px-5 text-[14px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Redirecting to Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.3 5.7c4.3-4 7.2-9.9 7.2-17.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.8 2.3-8.6 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
