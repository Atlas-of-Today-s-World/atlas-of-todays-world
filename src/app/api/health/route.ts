import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Service status for the uptime monitor and keep-alive (F2): whether the database
 * responds and which version is running. No secrets; 503 when the DB is down.
 */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  try {
    const { error } = await createPublicClient().from("regions").select("slug").limit(1);
    if (error) throw error;
  } catch (error) {
    console.error("[health] database", error instanceof Error ? error.message : error);
    db = "error";
  }
  const body = {
    status: db === "ok" ? "ok" : "degraded",
    db,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    ms: Date.now() - started,
  };
  return NextResponse.json(body, {
    status: db === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
