import "server-only";
import { SafeHtml } from "@/components/atlas/SafeHtml";
import { markdownToHtml } from "../markdown";
import { fileAnchor, githubFileUrl, SKILLS_FOLDER, skillLinkTarget, type Skill } from "../model";

const FILES_ID = "skill-files";

/** The body without its opening `# heading` when that is the title the page already shows. */
function withoutTitle({ body, title }: Skill): string {
  const lines = body.split("\n");
  const first = lines.findIndex((line) => line.trim());
  const heading = lines[first] ?? "";
  const text = heading.replace(/^#[ \t]+/, "").replace(/[ \t#]+$/, "");
  return /^#[ \t]/.test(heading) && text === title ? lines.slice(first + 1).join("\n") : body;
}

/**
 * A skill's text as a page: SKILL.md rendered from Markdown, then each of its
 * other files under its own heading (Markdown rendered, other text as code, a
 * binary file only named — it is in the ZIP). Links between the files lead to
 * those headings; HTML goes through `SafeHtml` like every editorial text.
 */
export function SkillDocument({ skill }: { skill: Skill }) {
  const others = skill.files.slice(1);
  // One set of heading ids for the whole page, starting with the ones set here.
  const ids = new Set([FILES_ID, ...others.map((file) => fileAnchor(file.path))]);
  const render = (markdown: string) =>
    markdownToHtml(markdown, { ids, link: (href) => skillLinkTarget(skill, href) });

  return (
    <div className="prose-atlas prose-skill">
      <SafeHtml html={render(withoutTitle(skill))} />
      {others.length ? (
        <section aria-labelledby={FILES_ID} className="mt-12 border-t border-[var(--color-line)]">
          <h2 id={FILES_ID}>Files of this skill</h2>
          {others.map((file) => (
            <section key={file.path} aria-labelledby={fileAnchor(file.path)} className="mt-8">
              <h3 id={fileAnchor(file.path)}>
                <a href={githubFileUrl(`${SKILLS_FOLDER}/${skill.name}/${file.path}`)}>
                  <code>{file.path}</code>
                </a>
              </h3>
              {file.text === null ? (
                <p>A binary file: it comes with the ZIP.</p>
              ) : /\.md$/i.test(file.path) ? (
                <SafeHtml html={render(file.text)} />
              ) : (
                <pre>
                  <code>{file.text}</code>
                </pre>
              )}
            </section>
          ))}
        </section>
      ) : null}
    </div>
  );
}
