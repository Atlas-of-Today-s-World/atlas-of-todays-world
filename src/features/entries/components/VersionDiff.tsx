import { diffParagraphs, paragraphs } from "@/lib/diff";

const STYLE = {
  same: "text-[var(--color-ink-muted)]",
  added: "bg-green-50 text-green-900 border-l-2 border-green-500 pl-2",
  removed: "bg-red-50 text-red-900 line-through border-l-2 border-red-400 pl-2",
} as const;

const MARK = { same: "", added: "Added: ", removed: "Removed: " } as const;

/** Co se změnilo proti zveřejněné verzi — titulek, perex a text po odstavcích. */
export function VersionDiff({
  before,
  after,
}: {
  before: { title: string; summary: string; body_html: string };
  after: { title: string; summary: string; body_html: string };
}) {
  const parts = diffParagraphs(
    [before.title, before.summary, ...paragraphs(before.body_html)],
    [after.title, after.summary, ...paragraphs(after.body_html)],
  );
  const changed = parts.some((part) => part.type !== "same");
  return (
    <details className="rounded-xl border border-[var(--color-line)] p-4" open={changed}>
      <summary className="cursor-pointer text-[13.5px] font-medium">
        Changes from the published version {changed ? "" : "(none)"}
      </summary>
      <ol className="mt-3 grid gap-1.5 text-[13px] leading-relaxed">
        {parts.map((part, index) => (
          <li key={index} className={STYLE[part.type]}>
            <span className="sr-only">{MARK[part.type]}</span>
            {part.text}
          </li>
        ))}
      </ol>
    </details>
  );
}
