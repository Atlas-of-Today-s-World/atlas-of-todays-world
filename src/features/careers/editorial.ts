import "server-only";
import { can } from "@/features/auth/access";
import type { Action, Permissions } from "@/config/sections";
import { must, rowsOf } from "@/lib/db/result";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Careers — admin reads (layer: features/<domain>/editorial.ts, ARCHITEKTURA
 * 4.1), under the user's session, no cache. Positions: section `site` or
 * `users`; applications: `users` only (RLS returns none to anyone else).
 */

/** May the user do `action` with positions? `site` or `users` — the rule of the RLS policies. */
export const positionRight = (permissions: Permissions, action: Action) =>
  can(permissions, "site", action) || can(permissions, "users", action);

/** Every position, newest first, with how many applications each has had. */
export async function listPositions() {
  const supabase = await createServerClient();
  const [positions, applications] = await Promise.all([
    supabase
      .from("job_positions")
      .select("id, slug, title, location, job_type, status, opened_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase.from("job_applications").select("position_id").limit(5000),
  ]);
  const counts = new Map<string, number>();
  for (const { position_id } of rowsOf(applications, "careers")) {
    if (position_id) counts.set(position_id, (counts.get(position_id) ?? 0) + 1);
  }
  return rowsOf(positions, "careers").map((row) => ({
    ...row,
    applications: counts.get(row.id) ?? 0,
  }));
}

export async function getPosition(id: string) {
  const supabase = await createServerClient();
  return must(
    await supabase
      .from("job_positions")
      .select("id, slug, title, location, job_type, summary, body_html, status, opened_at")
      .eq("id", id)
      .maybeSingle(),
    "careers",
  );
}

export type PositionRow = NonNullable<Awaited<ReturnType<typeof getPosition>>>;

/** The applications, newest first. */
export async function listApplications() {
  const supabase = await createServerClient();
  return rowsOf(
    await supabase
      .from("job_applications")
      .select(
        "id, position_id, position_title, name, email, message, cv_name, cv_size, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(2000),
    "careers",
  );
}
