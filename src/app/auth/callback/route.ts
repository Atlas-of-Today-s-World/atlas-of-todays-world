import type { NextRequest } from "next/server";
import { finishSignIn, signInFailed } from "@/features/auth/sign-in";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Return from Google (PKCE): exchanges the code for a session and completes sign-in. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return signInFailed(origin);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return signInFailed(origin);

  return finishSignIn(supabase, searchParams.get("next"), origin);
}
