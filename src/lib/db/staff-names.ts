import "server-only";
import type { ServerClient } from "@/lib/supabase/server";

/**
 * Display names of team members for "by" columns and edit stamps in the admin
 * (who saved a revision, who edited a chapter). Resolved by the DB function
 * `staff_name`, which answers only to an active staff member and only for staff
 * profiles (name, or the e-mail's local part when the name is empty), so no
 * profile columns are read directly. Profiles without a name (readers, removed
 * accounts) are left out of the result.
 */
export async function staffNames(
  supabase: ServerClient,
  people: Iterable<string | null | undefined>,
): Promise<Record<string, string>> {
  const ids = [...new Set([...people].filter((id): id is string => Boolean(id)))];
  const named = await Promise.all(
    ids.map(
      async (id) => [id, (await supabase.rpc("staff_name", { p_profile: id })).data] as const,
    ),
  );
  return Object.fromEntries(
    named.filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
  );
}
