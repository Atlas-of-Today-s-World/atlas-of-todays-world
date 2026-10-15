import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { UPLOAD_BUCKETS } from "@/lib/upload-rules";

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Storage lists and removes at most this many files per call. */
const PAGE = 1000;
const REMOVE_CHUNK = 100;

/** Every file directly in `{userId}/` of a bucket (folders skipped). */
async function listOwnFolder(service: ServiceClient, bucket: string, userId: string) {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await service.storage
      .from(bucket)
      .list(userId, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`[uploads] list ${bucket}: ${error.message}`);
    // A folder has no id; uploads are only ever `{user_id}/{uuid}.{ext}`.
    for (const item of data) if (item.id) paths.push(`${userId}/${item.name}`);
    if (data.length < PAGE) return paths;
  }
}

/**
 * When an account is deleted: removes the files it uploaded (`{user_id}/` in
 * the upload buckets) that nothing on the site uses any more. The database
 * decides what is unused (unreferenced_uploads: the file name appears in no
 * content, revision or setting); a file still used anywhere stays, so no
 * page loses an image or audio. Service key: the uploader may not delete
 * files under RLS (20261008000040), and the account is already gone.
 * Returns how many files were removed.
 */
export async function removeUnusedUploads(service: ServiceClient, userId: string): Promise<number> {
  let removed = 0;
  for (const bucket of UPLOAD_BUCKETS) {
    const paths = await listOwnFolder(service, bucket, userId);
    if (paths.length === 0) continue;
    const { data: unused, error } = await service.rpc("unreferenced_uploads", { p_paths: paths });
    if (error) throw new Error(`[uploads] check ${bucket}: ${error.message}`);
    // Only paths that were listed in this user's own folder, whatever comes back.
    const mine = (unused ?? []).filter((path) => paths.includes(path));
    for (let i = 0; i < mine.length; i += REMOVE_CHUNK) {
      const chunk = mine.slice(i, i + REMOVE_CHUNK);
      const result = await service.storage.from(bucket).remove(chunk);
      if (result.error) throw new Error(`[uploads] remove ${bucket}: ${result.error.message}`);
      removed += chunk.length;
    }
  }
  return removed;
}
