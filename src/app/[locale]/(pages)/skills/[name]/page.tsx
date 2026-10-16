import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { Lead } from "@/components/atlas/Note";
import { routes } from "@/config/routes";
import { breadcrumbNode, graph, pageUrl, webPageNode } from "@/features/seo/jsonld";
import { pageMetadata, pageTitle } from "@/features/seo/metadata";
import { getSiteSettings } from "@/features/site/queries";
import { SkillActions } from "@/features/skills/components/SkillActions";
import { SkillDocument } from "@/features/skills/components/SkillDocument";
import { roleLabel, SKILLS_PAGE } from "@/features/skills/model";
import { getSkill, getSkills } from "@/features/skills/queries";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { localeFrom } from "@/lib/i18n/request";

// true like the other prerendered pages under the shared layout: with false, Next
// returns 404 after revalidateTag (an admin write) even for existing pages
// (NoFallbackError). An unknown name ends up in notFound().
export const dynamicParams = true;

export function generateStaticParams() {
  return getSkills().map((skill) => ({ name: skill.name }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/skills/[name]">): Promise<Metadata> {
  const { name } = await params;
  const skill = getSkill(name);
  if (!skill) return {};
  return pageMetadata({
    locale: await localeFrom(params),
    path: routes.skill(skill.name),
    title: pageTitle(skill.title, "Claude skill"),
    description: skill.description || SKILLS_PAGE.description,
    languages: [DEFAULT_LOCALE],
  });
}

/** One Claude skill: its SKILL.md (and other files) rendered, with the raw file, ZIP and editor. */
export default async function SkillPage({ params }: PageProps<"/[locale]/skills/[name]">) {
  const { name } = await params;
  const locale = await localeFrom(params);
  const skill = getSkill(name);
  if (!skill) notFound();
  const site = await getSiteSettings();
  const path = routes.skill(skill.name);

  return (
    <main className="max-w-3xl">
      <Link
        href={routes.skills}
        className="inline-flex min-h-(--touch-min) items-center gap-1.5 text-[13px] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All skills
      </Link>
      <h1 className="font-display mt-2 text-[34px] font-bold">{skill.title}</h1>
      <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">
        Claude skill <code>{skill.name}</code>
        {skill.roles.length ? ` · for ${skill.roles.map(roleLabel).join(", ")}` : null}
      </p>
      {skill.description ? <Lead className="mt-4">{skill.description}</Lead> : null}
      <div className="mt-5 mb-10">
        <SkillActions name={skill.name} />
      </div>

      <SkillDocument skill={skill} />

      <JsonLd
        data={graph(
          webPageNode({
            url: pageUrl(path, locale),
            name: skill.title,
            description: skill.description,
            locale,
            type: "ItemPage",
            breadcrumb: breadcrumbNode(
              site,
              [
                { name: SKILLS_PAGE.title, path: routes.skills },
                { name: skill.title, path },
              ],
              locale,
            ),
          }),
        )}
      />
    </main>
  );
}
