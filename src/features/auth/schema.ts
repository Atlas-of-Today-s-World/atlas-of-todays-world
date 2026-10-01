import { z } from "zod";
import { emailAddress } from "@/lib/validation/common";
import { EMAIL_CODE_LENGTH, EMAIL_LOCALES } from "./constants";

/** Kam po přihlášení — cestu ověří až `safeRedirect`, tady jen délka. */
const next = z.string().max(500).optional();

/** Krok 1: e-mail, na který přijde kód (G1). */
export const EmailCodeRequest = z.object({
  email: emailAddress,
  next,
  locale: z.enum(EMAIL_LOCALES).default("en"),
  // Token z Cloudflare Turnstile; ověřuje ho Supabase Auth (captcha), když je zapnutá.
  captchaToken: z.string().max(4000).optional(),
});

/** Krok 2: kód z e-mailu. */
export const EmailCodeVerify = z.object({
  email: emailAddress,
  code: z.string().trim().length(EMAIL_CODE_LENGTH).regex(/^\d+$/),
  next,
});
