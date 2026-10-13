"use server";

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routes } from "@/config/routes";
import { publicEnv } from "@/lib/env";
import { safeRedirect } from "@/lib/security/redirect";
import { createServerClient } from "@/lib/supabase/server";
import type { GoogleSignInState } from "./constants";

const Next = z.string().max(500).optional();

/**
 * The site's origin for the return address. A Server Action is a POST from our
 * own page, whose Origin header Next.js has already checked against the host;
 * the site URL is only a fallback. Supabase Auth also accepts only redirect
 * URLs on its allow list.
 */
function siteOrigin(origin: string | null): string {
  try {
    const url = new URL(origin ?? "");
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  } catch {
    // no or malformed Origin header
  }
  return new URL(publicEnv.NEXT_PUBLIC_SITE_URL).origin;
}

/**
 * Sign-in with Google (PKCE), started on the server: the PKCE code verifier is
 * written as an httpOnly cookie here and read back by /auth/callback, which
 * exchanges the code for the session. The browser only follows the redirect.
 */
export async function startGoogleSignIn(
  _prev: GoogleSignInState,
  formData: FormData,
): Promise<GoogleSignInState> {
  const parsed = Next.safeParse(formData.get("next") ?? undefined);
  const next = safeRedirect(parsed.success ? parsed.data : undefined, routes.account);
  const callback = new URL("/auth/callback", siteOrigin((await headers()).get("origin")));
  callback.searchParams.set("next", next);

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    console.error("[google-sign-in]", error?.code ?? error?.message ?? "no url");
    return { ok: false, error: "unreachable" };
  }
  redirect(data.url);
}
