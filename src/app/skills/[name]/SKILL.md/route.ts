import { routes } from "@/config/routes";
import { getSkill, getSkills } from "@/features/skills/queries";
import { absoluteUrl } from "@/lib/seo";
import { machineResponse } from "@/lib/seo/response";

/**
 * A skill's SKILL.md exactly as in the repository (`/skills/<name>/SKILL.md`):
 * to read raw, or to give Claude by URL. The page /skills/<name> stays the
 * canonical one (Link header). Built once at deploy time.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getSkills().map((skill) => ({ name: skill.name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const text = getSkill(name)?.files[0]?.text;
  if (text == null) return new Response("Not found", { status: 404 });
  return machineResponse(text, "markdown", {
    link: `<${absoluteUrl(routes.skill(name))}>; rel="canonical"`,
  });
}
