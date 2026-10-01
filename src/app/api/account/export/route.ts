import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GDPR Art. 15/20: a signed-in user downloads their data as JSON. Read with the session
 * client, so RLS returns only their own rows (profile, memberships, own articles).
 * The account is deleted by the button on the account page (deleteAccount).
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [profile, membership, entries] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, name, phone, kind, status, role_id, created_at, last_seen_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("plan, status, complimentary, started_at, current_period_end, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("entries")
      .select("slug, kind, locale, title, status, created_at, updated_at")
      .eq("owner_id", user.id)
      .order("created_at"),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      providers: user.app_metadata?.providers ?? [],
    },
    profile: profile.data,
    membership: membership.data,
    entries: entries.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atlas-account-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
