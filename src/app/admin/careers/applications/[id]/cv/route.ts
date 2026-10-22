import { NextResponse } from "next/server";
import { CV_BUCKET } from "@/features/careers/cv";
import { createServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

/** Long enough to start the download, too short to pass the link around. */
const SIGNED_SECONDS = 60;

/**
 * One application's CV (Admin → Careers → Applications): a redirect to a
 * signed URL of the private bucket, made under the team member's own session —
 * RLS lets only the `users` section read the application and the storage
 * policy only them sign its file. Anyone else gets a 404. No service key.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/admin/careers/applications/[id]/cv">,
) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return notFound();
  const supabase = await createServerClient();
  const { data: row } = await supabase
    .from("job_applications")
    .select("cv_path, cv_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return notFound();
  const { data, error } = await supabase.storage
    .from(CV_BUCKET)
    .createSignedUrl(row.cv_path, SIGNED_SECONDS, { download: row.cv_name });
  if (error || !data) return notFound();
  const response = NextResponse.redirect(data.signedUrl, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

const notFound = () =>
  new NextResponse("Not found.", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
