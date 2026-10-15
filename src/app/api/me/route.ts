import { NextResponse } from "next/server";
import { getAccess, opensAdmin } from "@/features/auth/access";
import { SIGNED_OUT, type Me } from "@/features/auth/types";
import { supabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/** Per person and per moment: no shared cache (CDN) may keep it, nor the browser. */
const PRIVATE = { "Cache-Control": "private, no-store" };

/**
 * Who is signed in, for the header's account menu (opened on any page). The
 * header is on static pages, so it never reads the session on the server —
 * the browser asks here when the menu opens. The session is verified with
 * getUser() (Auth server), never only read from the cookie. Answers the four
 * fields the menu shows and nothing else; a visitor without a session (or a
 * build without Supabase) is simply signed out.
 */
export async function GET() {
  const access = supabaseConfig() ? await getAccess() : null;
  const body: Me = access
    ? {
        signedIn: true,
        email: access.email,
        roleName: access.roleName,
        isStaff: await opensAdmin(access),
      }
    : SIGNED_OUT;
  return NextResponse.json(body, { headers: PRIVATE });
}
