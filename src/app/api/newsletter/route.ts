import { NextResponse } from "next/server";

/**
 * Přihlášení k odběru přes Mailchimp.
 *
 * Běží na serveru, protože klíč k API nesmí do prohlížeče. Používá dvojité
 * potvrzení (`pending`): Mailchimp pošle ověřovací e-mail a do seznamu se
 * adresa dostane, až na něj člověk klikne. Bez toho by šlo přihlásit cizí
 * adresu a byl by to problém i podle GDPR.
 *
 * Nastavení: MAILCHIMP_API_KEY (tvar `klíč-us21`) a MAILCHIMP_LIST_ID.
 */
export const dynamic = "force-dynamic";

/** Jednoduché omezení četnosti v paměti procesu. */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.until < now) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Past na roboty: skript vyplní i pole, které člověk nevidí.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, message: "Thanks." });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That address looks wrong." }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: "Please tick the consent box." }, { status: 400 });
  }

  const key = process.env.MAILCHIMP_API_KEY;
  const list = process.env.MAILCHIMP_LIST_ID;
  if (!key || !list) {
    // Prototyp bez nastaveného Mailchimpu: řekneme to rovnou místo tiché chyby.
    return NextResponse.json({ error: "The newsletter is not connected yet." }, { status: 503 });
  }

  const datacenter = key.split("-")[1];
  const response = await fetch(
    `https://${datacenter}.api.mailchimp.com/3.0/lists/${list}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email, status: "pending" }),
    },
  );

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { title?: string };
    // Už přihlášená adresa není chyba návštěvníka.
    if (detail.title === "Member Exists") {
      return NextResponse.json({ ok: true, message: "You are already on the list." });
    }
    return NextResponse.json({ error: "Sign-up failed. Try again later." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: "Almost there — confirm the email we just sent.",
  });
}
