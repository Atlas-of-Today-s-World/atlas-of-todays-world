"use server";

import "server-only";
import { z } from "zod";
import { signedIn } from "@/lib/actions";
import { isoDay } from "@/lib/format";
import { mfaGate } from "./mfa";

/**
 * Two-factor authentication (TOTP, E10) on the server: the session cookies are
 * httpOnly, so enrolment, challenge and verification run here under the
 * caller's session. Nothing returned carries a session token — enrolment
 * returns only the QR code and key to type into the app, verification only
 * whether it worked (the session moves to aal2 in the cookies).
 */

export type MfaEnrollment =
  | { ok: true; qr: string; secret: string }
  | { ok: false; error: "signIn" | "notNeeded" | "failed" };

export type MfaVerification = { ok: true } | { ok: false; error: "signIn" | "code" | "failed" };

const Code = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

/**
 * Starts enrolment of an authenticator app — only for a signed-in user whose
 * role requires a second factor and who has none yet. Unfinished attempts
 * are removed first, otherwise a new one can't be created.
 */
export async function startMfaEnrollment(): Promise<MfaEnrollment> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "signIn" };
  const gate = await mfaGate();
  if (!gate || gate.hasFactor) return { ok: false, error: "notNeeded" };

  const { auth } = session.supabase;
  const { data: factors, error: listError } = await auth.mfa.listFactors();
  if (listError) return { ok: false, error: "failed" };
  for (const factor of factors.all.filter((f) => f.status === "unverified")) {
    await auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Atlas ${isoDay()}`,
  });
  if (error) return { ok: false, error: "failed" };
  return { ok: true, qr: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * Verifies a six-digit code against the user's TOTP factor: the verified one,
 * or else the one being enrolled. The factor is chosen here, not by the browser.
 */
export async function verifyMfaCode(input: unknown): Promise<MfaVerification> {
  const parsed = Code.safeParse(input);
  if (!parsed.success) return { ok: false, error: "code" };
  const session = await signedIn();
  if (!session) return { ok: false, error: "signIn" };

  const { auth } = session.supabase;
  const { data: factors, error: listError } = await auth.mfa.listFactors();
  if (listError) return { ok: false, error: "failed" };
  const factor =
    factors.totp.find((f) => f.status === "verified") ??
    factors.all.findLast((f) => f.factor_type === "totp" && f.status === "unverified");
  if (!factor) return { ok: false, error: "failed" };

  const { error } = await auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data });
  return error ? { ok: false, error: "code" } : { ok: true };
}
