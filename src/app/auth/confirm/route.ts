import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { finishSignIn, signInFailed } from "@/features/auth/sign-in";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/** Odkaz z e-mailu (registrace, pozvánka, magic link): ověří token_hash a přihlásí. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) return signInFailed(origin);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return signInFailed(origin);

  return finishSignIn(supabase, searchParams.get("next"), origin);
}
