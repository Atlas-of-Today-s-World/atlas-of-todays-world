import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Přihlášení do administrace sdíleným heslem.
 *
 * Heslo se porovnává v konstantním čase, ať se nedá uhodnout podle toho, jak
 * dlouho odpověď trvá. Cookie je httpOnly a SameSite=Lax, takže se k ní
 * nedostane JavaScript ani cizí stránka.
 *
 * Tohle je mezistupeň. Cílem je přihlášení přes Supabase Auth s rolemi
 * (docs/build-brief.md, P14) – sdílené heslo neumí říct, kdo co udělal.
 */
export const dynamic = "force-dynamic";

const COOKIE = "atlas_admin";
const MAX_AGE = 60 * 60 * 12;

/** Pokusy o uhodnutí hesla brzdíme podle adresy. */
const attempts = new Map<string, { count: number; until: number }>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.until < now) {
    attempts.set(ip, { count: 1, until: now + 10 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Administrace nemá nastavené heslo (ADMIN_TOKEN)." },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(ip)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů. Zkus to za chvíli." }, { status: 429 });
  }

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  if (!token || !sameSecret(token, expected)) {
    return NextResponse.json({ error: "Špatné heslo." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return response;
}

/** Odhlášení. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
