import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The visitor's country by IP address, so the home globe opens turned to it.
 * Vercel's edge fills `x-vercel-ip-country` (ISO 3166-1 alpha-2); only that code
 * is returned, nothing is stored, and the answer is never cached or shared.
 */
export function GET(request: Request) {
  const header = request.headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  const country = /^[A-Z]{2}$/.test(header) ? header : null;
  return NextResponse.json({ country }, { headers: { "Cache-Control": "private, no-store" } });
}
