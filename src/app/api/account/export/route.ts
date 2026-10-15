import { NextResponse } from "next/server";
import { must, rowsOf } from "@/lib/db/result";
import { isoDay } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GDPR Art. 15/20: a signed-in user downloads their data as JSON. Everything is
 * read with the session client, so RLS returns only their own rows (profile,
 * membership, own articles, page views, approver scope; the profile includes the
 * blocked note — a note about them). The parts RLS can't hand to their owner —
 * invitations to their verified e-mail (with the note), their volunteer
 * applications, the linked author profile, the metadata of entry and site page
 * revisions they saved and their own audit actions (column names, never values)
 * — come from my_personal_data(), a definer RPC scoped to auth.uid() (migrations
 * 20261013000350 and …360). The second factors come from Supabase Auth with the
 * same session: name, type, status and date only, never a secret or QR code.
 * No service key.
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
    const [profile, membership, entries, pageViews, countries, authors, personal, factors] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, email, name, phone, kind, status, role_id, approval_global, created_at, last_seen_at, blocked_note",
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
        supabase.auth.mfa.listFactors(),
      ]);
    if (factors.error) throw new Error(`[export factors] ${factors.error.message}`);
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
      // Added by the retention decisions of 2026-10-15 (keys only ever added).
      sitePageRevisions: extra.sitePageRevisions ?? [],
      auditActions: extra.auditActions ?? [],
      // Picked field by field: nothing else of a factor (secret, QR) can slip in.
      twoFactorFactors: (factors.data?.all ?? []).map((factor) => ({
        friendlyName: factor.friendly_name ?? null,
        factorType: factor.factor_type,
        status: factor.status,
        createdAt: factor.created_at,
      })),
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
