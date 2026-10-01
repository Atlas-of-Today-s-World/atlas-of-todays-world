import "server-only";
import { NextResponse } from "next/server";
import { safeRedirect } from "@/lib/security/redirect";
import type { createServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createServerClient>>;

const DEFAULT_AFTER_SIGN_IN = "/ucet";

/**
 * Dokončení přihlášení (Google i odkaz z e-mailu): přijme čekající pozvánku
 * a pošle uživatele dál — jen na vlastní web.
 *
 * Pozvánku často přijme už trigger při založení účtu, takže o cíli nerozhoduje
 * výsledek `claim_invitation()`, ale role: člen týmu bez konkrétního cíle
 * jde rovnou do administrace.
 */
export async function finishSignIn(supabase: Client, next: string | null, origin: string) {
  const target = safeRedirect(next, DEFAULT_AFTER_SIGN_IN);
  await supabase.rpc("claim_invitation");

  let destination = target;
  if (target === DEFAULT_AFTER_SIGN_IN) {
    const { data: role } = await supabase.rpc("my_role");
    if (role && role.id !== "reader") destination = "/admin";
  }
  return NextResponse.redirect(new URL(destination, origin));
}

export function signInFailed(origin: string) {
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
