import { NextResponse } from "next/server";
import { getAccess, opensAdmin } from "@/features/auth/access";
import { SIGNED_OUT, type Me } from "@/features/auth/types";
import { supabaseConfig } from "@/lib/supabase/config";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Per person and per moment: no shared cache (CDN) may keep it, nor the browser. */
const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * Who is signed in, for the header's account menu (opened on any page). The
 * header is on static pages, so it never reads the session on the server —
 * the browser asks here when the menu opens (the session cookies are httpOnly,
 * no page script holds a token). The session is verified with getUser() (Auth
 * server), never only read from the cookie; the name comes from the visitor's
 * own profile, read under RLS with the session. Answers the five fields the
 * menu shows and nothing else; a visitor without a session (or a build
 * without Supabase) is simply signed out.
 */
export async function GET() {
  const access = supabaseConfig() ? await getAccess() : null;
  if (!access) return NextResponse.json(SIGNED_OUT, { headers: PRIVATE });

  const supabase = await createServerClient();
  const [{ data: profile }, isStaff] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", access.userId).maybeSingle(),
    opensAdmin(access),
  ]);
  const body: Me = {
    signedIn: true,
    // A missing name (or a failed read) only means the menu shows the e-mail alone.
    name: profile?.name?.trim() || null,
    email: access.email,
    roleName: access.roleName,
    isStaff,
  };
  return NextResponse.json(body, { headers: PRIVATE });
}
