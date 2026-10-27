import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared front of the cookie-less beacon endpoints (/api/e conversions, /api/v
 * web vitals): `navigator.sendBeacon` posts a small JSON body from our own
 * pages. Nobody waits for the answer, so it is an empty status, never cached.
 */
export const beaconAnswer = (status: number) =>
  new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * The parsed JSON body of a same-origin beacon, or the status to answer:
 * 403 from another site, 413 over `maxBytes`, 400 not JSON.
 */
export async function readBeacon(
  request: NextRequest,
  maxBytes: number,
): Promise<{ body: unknown } | { status: 400 | 403 | 413 }> {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return { status: 403 };
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return { status: 413 };
  const text = await request.text().catch(() => "");
  if (new TextEncoder().encode(text).length > maxBytes) return { status: 413 };
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { status: 400 };
  }
}
