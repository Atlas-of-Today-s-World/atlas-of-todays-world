import { skillFiles } from "@/config/routes";
import { getSkill, getSkills, skillsZip } from "@/features/skills/queries";

/**
 * A skill as a ZIP to upload to claude.ai or unpack into `.claude/skills`
 * (`/skills/<name>.zip`), and every skill in one (`/skills/all.zip`). The
 * segment is the file name; built once at deploy time from the repository.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const ALL = skillFiles.all.split("/").pop()!;

export function generateStaticParams() {
  return [ALL, ...getSkills().map((skill) => `${skill.name}.zip`)].map((name) => ({ name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name: file } = await params;
  const name = /^(.+)\.zip$/.exec(file)?.[1];
  const skill = name ? getSkill(name) : undefined;
  const skills = file === ALL ? getSkills() : skill ? [skill] : [];
  // The file name is now a known one (a skill's names are [a-z0-9-]), safe in the header.
  if (!skills.length) return new Response("Not found", { status: 404 });
  return new Response(skillsZip(skills), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${file}"`,
    },
  });
}
