import { z } from "zod";
import { checkbox, uuid } from "@/lib/validation/common";

/**
 * Redirects (table `redirects`) — shapes matching the CHECK in the DB: the source
 * is a path on this site without a trailing slash, the target is also a path on
 * this site (no foreign domain → no open redirect).
 */
const FROM = /^\/[A-Za-z0-9._~%!$&'()*+,;=:@/-]+$/;
const TO = /^\/[A-Za-z0-9._~%!$&'()*+,;=:@/?#-]*$/;

const path = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(300, "At most 300 characters.")
    .regex(pattern, message)
    .refine((value) => !value.startsWith("//"), message);

export const RedirectInput = z
  .object({
    from_path: path(FROM, "A path on this website, e.g. /news/old-title (no domain).").refine(
      (value) => value.length > 1 && !value.endsWith("/"),
      "No trailing slash, and not the whole website.",
    ),
    to_path: path(TO, "A path on this website, e.g. /news/new-title (no domain)."),
    permanent: checkbox,
  })
  .refine((value) => value.from_path !== value.to_path, {
    path: ["to_path"],
    message: "The target must be a different URL.",
  });
export type RedirectInput = z.infer<typeof RedirectInput>;

export const RedirectId = uuid;

export interface RedirectRule {
  to: string;
  permanent: boolean;
}

/** Path in a single form for comparison: decoded, without a trailing slash. */
export function normalizePath(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURI(value);
  } catch {
    // Invalid %-encoding → compared as received.
  }
  return decoded.length > 1 ? decoded.replace(/\/+$/, "") : decoded;
}

/** Rule table for fast lookup (key = normalized source path). */
export function buildRedirectMap(
  rows: { from_path: string; to_path: string; permanent: boolean }[],
): Record<string, RedirectRule> {
  const map: Record<string, RedirectRule> = {};
  for (const row of rows) {
    map[normalizePath(row.from_path)] = { to: row.to_path, permanent: row.permanent };
  }
  return map;
}

export function matchRedirect(
  map: Record<string, RedirectRule>,
  pathname: string,
): RedirectRule | null {
  const key = normalizePath(pathname);
  return Object.hasOwn(map, key) ? (map[key] ?? null) : null;
}
