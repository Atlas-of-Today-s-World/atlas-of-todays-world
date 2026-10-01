import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Stav služby pro uptime monitor a keep-alive (F2): databáze odpovídá a jaká
 * verze běží. Bez tajných údajů; 503, když DB nejde.
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
