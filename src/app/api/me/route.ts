import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** What the header's account menu needs to know about the visitor. */
export interface MeResponse {
  signedIn: boolean;
  email?: string;
  name?: string;
  /** A member of the editorial team (offered the way to the administration). */
  staff?: boolean;
}

/**
 * Who is signed in, for the account menu in the header. The session cookies
 * are httpOnly (no page script holds a token), so the menu asks here when it
 * opens. Verified with the Auth server (getUser), the profile read under RLS
 * (only the visitor's own row); never cached, and nothing beyond the e-mail,
 * the name and whether they are on the team.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedIn: false } satisfies MeResponse, { headers });

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, kind, status")
    .eq("id", user.id)
    .maybeSingle();
  const body: MeResponse = {
    signedIn: true,
    email: user.email ?? undefined,
    name: profile?.name?.trim() || undefined,
    staff: profile?.kind === "staff" && profile.status === "active",
  };
  return NextResponse.json(body, { headers });
}
