import { z } from "zod";
import { emailAddress } from "@/lib/validation/common";
import { EMAIL_CODE_LENGTH, EMAIL_LOCALES } from "./constants";

/** Where to go after sign-in — `safeRedirect` validates the path; here just the length. */
const next = z.string().max(500).optional();

/** Step 1: the email the code is sent to (G1). */
export const EmailCodeRequest = z.object({
  email: emailAddress,
  next,
  locale: z.enum(EMAIL_LOCALES).default("en"),
  // Cloudflare Turnstile token; verified by Supabase Auth (captcha) when enabled.
  captchaToken: z.string().max(4000).optional(),
});

/** Krok 2: kód z e-mailu. */
export const EmailCodeVerify = z.object({
  email: emailAddress,
  code: z.string().trim().length(EMAIL_CODE_LENGTH).regex(/^\d+$/),
  next,
});
