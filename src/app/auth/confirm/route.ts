import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { CONFIRM_PAGE, finishSignIn, signInFailed } from "@/features/auth/sign-in";
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

type Field = (name: string) => FormDataEntryValue | null;

function readParams(field: Field) {
  const tokenHash = field("token_hash");
  const type = field("type");
  const next = field("next");
  if (typeof tokenHash !== "string" || !tokenHash || tokenHash.length > 500) return null;
  if (typeof type !== "string" || !TYPES.includes(type as EmailOtpType)) return null;
  return {
    tokenHash,
    type: type as EmailOtpType,
    next: typeof next === "string" ? next.slice(0, 500) : null,
  };
}

/**
 * Link from an e-mail (sign-up, invitation, magic link). Opening it signs no one
 * in: it leads to a page that asks to continue and posts back here. A link
 * someone else sent therefore can't quietly sign this browser into their
 * account, and mail scanners that open links don't use the token up.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const params = readParams((name) => searchParams.get(name));
  if (!params) return signInFailed(origin);
  const page = new URL(CONFIRM_PAGE, origin);
  page.searchParams.set("token_hash", params.tokenHash);
  page.searchParams.set("type", params.type);
  if (params.next) page.searchParams.set("next", params.next);
  return NextResponse.redirect(page, 303);
}

/** The "continue" button of that page — only from our own site — verifies the token and signs in. */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const params = form ? readParams((name) => form.get(name)) : null;
  if (!params) return signInFailed(origin);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: params.tokenHash,
    type: params.type,
  });
  if (error) return signInFailed(origin);
  return finishSignIn(supabase, params.next, origin);
}
