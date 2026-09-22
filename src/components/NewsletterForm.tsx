"use client";

import { useState } from "react";

/**
 * Přihlášení k odběru novinek.
 *
 * Adresa jde na vlastní serverovou routu, ne rovnou do Mailchimpu – klíč
 * k jejich API nesmí do prohlížeče. Souhlas je vědomý (zaškrtávátko), potvrzení
 * dvojité (Mailchimp pošle ověřovací e-mail), a `website` je past na roboty:
 * lidé to pole nevidí, vyplní ho jen skript.
 */
export default function NewsletterForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          consent: form.get("consent") === "on",
          website: form.get("website"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-up failed.");
      setState("done");
      setMessage(data.message ?? "Check your inbox to confirm.");
      (event.target as HTMLFormElement).reset();
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "Sign-up failed.");
    }
  }

  return (
    <form onSubmit={submit} className="text-[13px]">
      <label htmlFor="newsletter-email" className="block font-medium">
        New Atlas content in your inbox
      </label>

      <div className="mt-2 flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.org"
          className="min-h-11 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 text-[14px] text-white placeholder:text-white/40 focus:border-white/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="min-h-11 rounded-lg bg-white px-4 text-[13px] font-medium text-[#0d1324] transition hover:bg-white/85 disabled:opacity-60"
        >
          {state === "sending" ? "…" : "Sign up"}
        </button>
      </div>

      <label className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-white/60">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          Send me occasional emails about new Atlas entries. I can unsubscribe at
          any time.
        </span>
      </label>

      {/* Past na roboty: pro lidi neviditelné pole. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      {state !== "idle" && message ? (
        <p
          role="status"
          className={`mt-2.5 text-[12px] ${
            state === "error" ? "text-red-300" : "text-emerald-300"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
