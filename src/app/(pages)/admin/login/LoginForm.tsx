"use client";

import { useState } from "react";

/**
 * Formulář k přihlášení sdíleným heslem. Heslo se posílá na server, který ho
 * porovná s `ADMIN_TOKEN` a nastaví httpOnly cookie – v prohlížeči se nikde
 * neukládá a JavaScript se k cookie nedostane.
 */
export default function LoginForm({
  next,
  error,
}: {
  next: string;
  error?: string;
}) {
  const [message, setMessage] = useState(error ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.get("token") }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Přihlášení selhalo.");
      }
      window.location.href = next;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Přihlášení selhalo.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-3">
      <label className="text-[12px] font-medium text-[var(--color-ink-muted)]" htmlFor="token">
        Heslo redakce
      </label>
      <input
        id="token"
        name="token"
        type="password"
        required
        autoComplete="current-password"
        className="min-h-11 rounded-lg border border-[var(--color-line)] bg-white px-3 text-[14px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none"
      />

      {message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-full bg-[var(--color-accent)] px-6 text-[14px] font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:opacity-50"
        >
          {busy ? "Přihlašuji…" : "Přihlásit"}
        </button>
      </div>
    </form>
  );
}
