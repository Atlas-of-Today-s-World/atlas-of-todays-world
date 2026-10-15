import { NextResponse } from "next/server";
import { must, rowsOf } from "@/lib/db/result";
import { isoDay } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GDPR Art. 15/20: a signed-in user downloads their data as JSON. Everything is
 * read with the session client, so RLS returns only their own rows (profile,
 * membership, own articles, page views, approver scope). The parts RLS can't
 * hand to their owner — invitations to their verified e-mail, their volunteer
 * applications, the linked author profile and the metadata of revisions they
 * saved — come from my_personal_data(), a definer RPC scoped to auth.uid()
 * (migration 20261013000350). No service key.
 *
 * Keys are only ever added, never renamed, so an older download keeps its
 * meaning. A failed read fails the whole export: an incomplete copy must not
 * look complete. The account is deleted on the account page (deleteAccount).
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body;
  try {
    const [profile, membership, entries, pageViews, countries, authors, personal] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, email, name, phone, kind, status, role_id, approval_global, created_at, last_seen_at",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("memberships")
          .select(
            "plan, status, complimentary, monthly_amount_cents, started_at, current_period_end, updated_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("entries")
          .select("slug, kind, locale, title, status, created_at, updated_at")
          .eq("owner_id", user.id)
          .order("created_at"),
        supabase.from("page_views_daily").select("day, views").eq("user_id", user.id).order("day"),
        supabase
          .from("approver_countries")
          .select("country_iso3")
          .eq("user_id", user.id)
          .order("country_iso3"),
        supabase
          .from("approver_authors")
          .select("author_id")
          .eq("user_id", user.id)
          .order("author_id"),
        supabase.rpc("my_personal_data"),
      ]);
    const extra = (must(personal, "export personal data") ?? {}) as Record<string, unknown>;
    body = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        providers: user.app_metadata?.providers ?? [],
      },
      profile: must(profile, "export profile"),
      membership: must(membership, "export membership"),
      entries: rowsOf(entries, "export entries"),
      // Added by S-L14 (keys only ever added).
      pageViews: rowsOf(pageViews, "export page views"),
      approverScope: {
        countries: rowsOf(countries, "export approver countries").map((row) => row.country_iso3),
        authorAccounts: rowsOf(authors, "export approver authors").map((row) => row.author_id),
      },
      authorProfile: extra.authorProfile ?? null,
      invitations: extra.invitations ?? [],
      volunteerApplications: extra.volunteerApplications ?? [],
      entryRevisions: extra.entryRevisions ?? [],
    };
  } catch (error) {
    console.error("[account] export failed", (error as Error).message);
    return NextResponse.json({ error: "The export failed. Please try again." }, { status: 500 });
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atlas-account-${isoDay()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
