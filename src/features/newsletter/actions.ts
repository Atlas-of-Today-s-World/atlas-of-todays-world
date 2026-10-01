"use server";

import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { firstIssue, type ActionState } from "@/lib/actions";
import { serverEnv } from "@/lib/env.server";
import { allowRequest } from "@/lib/security/rate-limit";

const Input = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "invalidEmail")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "invalidEmail"),
  consent: z.literal("on", { message: "consent" }),
});

/**
 * Results are codes (messages: newsletterForm.messages) — the form picks the
 * text in the page language.
 */
const CONFIRM = "confirm";

/**
 * Newsletter subscription via Mailchimp (the API key must not reach the browser).
 * Double opt-in (`pending`): the address joins the list only after the person
 * clicks the confirmation email — otherwise someone else's address could be subscribed (GDPR).
 * The rate limit is shared in Postgres (SEC-06); `website` is a honeypot for bots.
 */
export async function subscribe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("website") ?? "").trim()) return { ok: true, message: "thanks" };
  if (!(await allowRequest("newsletter", await headers(), { limit: 5, windowSeconds: 600 }))) {
    return { ok: false, error: "rateLimited" };
  }
  const parsed = Input.safeParse({
    email: formData.get("email"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const key = serverEnv.MAILCHIMP_API_KEY;
  const list = serverEnv.MAILCHIMP_LIST_ID;
  if (!key || !list) return { ok: false, error: "notConnected" };

  const datacenter = key.split("-")[1];
  const response = await fetch(
    `https://${datacenter}.api.mailchimp.com/3.0/lists/${encodeURIComponent(list)}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: parsed.data.email, status: "pending" }),
    },
  );
  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { title?: string };
    // An already subscribed address gets the same response as a new one — otherwise
    // one could find out who is subscribed.
    if (detail.title === "Member Exists") return { ok: true, message: CONFIRM };
    return { ok: false, error: "failed" };
  }
  return { ok: true, message: CONFIRM };
}
