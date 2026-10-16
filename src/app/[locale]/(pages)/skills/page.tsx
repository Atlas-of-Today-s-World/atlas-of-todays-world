import { Download } from "lucide-react";
import Link from "@/components/i18n/Link";
import { JsonLd } from "@/components/JsonLd";
import { EmptyNote, Lead } from "@/components/atlas/Note";
import { buttonVariants } from "@/components/ui/button";
import { routes, skillFiles } from "@/config/routes";
import { collectionPageGraph } from "@/features/seo/jsonld";
import { pageMetadata } from "@/features/seo/metadata";
import { getSiteSettings } from "@/features/site/queries";
import { SkillActions } from "@/features/skills/components/SkillActions";
import {
  SKILLS_ON_GITHUB,
  groupByRole,
  roleLabel,
  SKILLS_FOLDER,
  SKILLS_PAGE,
  skillLinks,
} from "@/features/skills/model";
import { getSkills } from "@/features/skills/queries";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { localeFrom } from "@/lib/i18n/request";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/skills">) {
  return pageMetadata({
    locale: await localeFrom(params),
    path: routes.skills,
    title: SKILLS_PAGE.title,
    description: SKILLS_PAGE.description,
    languages: [DEFAULT_LOCALE],
  });
}

/**
 * The project's Claude skills (.claude/skills in the repository): what they
 * are, how to load them, and each one with its links, grouped by role when
 * the skills name roles. Prerendered at build time from the files.
 */
export default async function SkillsPage({ params }: PageProps<"/[locale]/skills">) {
  const locale = await localeFrom(params);
  const skills = getSkills();
  const groups = groupByRole(skills);
  const site = await getSiteSettings();
  const example = skills[0]?.name ?? "atlas-architektura";

  return (
    <main className="max-w-3xl">
      <h1 className="font-display text-[34px] font-bold">{SKILLS_PAGE.title}</h1>
      <Lead className="mt-3 max-w-2xl">
        Skills are short instructions with reference files that teach Claude how this project works
        — its architecture, its rules, its components. The team works with them every day; they are
        public, so anyone can read them, reuse them or load them into their own Claude.
      </Lead>

      <section aria-labelledby="how-to-use" className="prose-atlas prose-skill mt-8">
        <h2 id="how-to-use">How to use them</h2>
        <ul>
          <li>
            <strong>Claude Code</strong> loads them by itself in a clone of{" "}
            <a href={SKILLS_ON_GITHUB}>this repository</a> (from <code>{SKILLS_FOLDER}</code>).
            Elsewhere, unpack a skill&apos;s ZIP into your project&apos;s{" "}
            <code>.claude/skills/</code> or into <code>~/.claude/skills/</code>.
          </li>
          <li>
            <strong>claude.ai</strong>: download a skill&apos;s ZIP and upload it in{" "}
            <a href="https://claude.ai/settings/capabilities">Settings → Capabilities → Skills</a>{" "}
            (one ZIP per skill).
          </li>
          <li>
            <strong>Any chat</strong>: paste the raw file&apos;s address, e.g.{" "}
            <code>{absoluteUrl(skillFiles.raw(example))}</code>, and ask Claude to follow it.
          </li>
        </ul>
      </section>

      {skills.length ? (
        <>
          <p className="mt-6">
            <a
              href={skillFiles.all}
              download
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              <Download aria-hidden className="size-4" />
              Download all skills (ZIP)
            </a>
          </p>
          {groups.map((group) => {
            const id = group.role
              ? `role-${group.role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
              : "general";
            const heading = group.role
              ? roleLabel(group.role)
              : groups.length > 1
                ? "Other skills"
                : "All skills";
            return (
              <section
                key={id}
                aria-labelledby={id}
                className="mt-10 border-t border-[var(--color-line)] pt-6"
              >
                <h2 id={id} className="font-display text-[20px] font-bold">
                  {heading}
                </h2>
                <ul className="mt-4 space-y-6">
                  {group.skills.map((skill) => (
                    <li key={skill.name}>
                      <h3 className="font-display text-[17px] font-bold">
                        <Link
                          href={routes.skill(skill.name)}
                          className="hover:text-[var(--color-accent)] hover:underline"
                        >
                          {skill.title}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-[12px] text-[var(--color-ink-muted)]">
                        <code>{skill.name}</code>
                        {skill.roles.length ? ` · ${skill.roles.map(roleLabel).join(", ")}` : null}
                      </p>
                      {skill.description ? (
                        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-soft)]">
                          {skill.description}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <SkillActions name={skill.name}>
                          <Link
                            href={skillLinks(skill.name).page}
                            className={buttonVariants({ variant: "outline", size: "chip" })}
                          >
                            Read
                          </Link>
                        </SkillActions>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      ) : (
        <EmptyNote className="mt-8">No skills are published yet.</EmptyNote>
      )}

      <p className="mt-12 border-t border-[var(--color-line)] pt-6 text-[13px] text-[var(--color-ink-muted)]">
        Skills are files in the repository, changed by pull request on{" "}
        <a href={SKILLS_ON_GITHUB} className="underline">
          GitHub
        </a>
        ; this page shows them as of the last deploy.
      </p>

      <JsonLd
        data={collectionPageGraph({
          path: routes.skills,
          name: SKILLS_PAGE.title,
          description: SKILLS_PAGE.description,
          locale,
          site,
          items: skills.map((skill) => ({ name: skill.title, path: routes.skill(skill.name) })),
        })}
      />
    </main>
  );
}
