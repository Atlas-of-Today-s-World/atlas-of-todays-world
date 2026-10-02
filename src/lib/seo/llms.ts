/**
 * llms.txt (https://llmstxt.org): a Markdown map of the site for language
 * models — H1 name, a blockquote summary, a few paragraphs, then H2 sections
 * of links with notes; the "Optional" section may be skipped by agents.
 * llms-full.txt (an informal convention) adds the full text of the articles.
 */

export interface LlmsLink {
  name: string;
  url: string;
  note?: string;
}

export interface LlmsSection {
  title: string;
  links: LlmsLink[];
}

export interface LlmsDocument {
  title: string;
  url: string;
  /** "Published: …", "Author: …" lines under the title. */
  facts: string[];
  /** Body in Markdown. */
  markdown: string;
}

/** One line of a link list; notes are kept on one line. */
const line = (link: LlmsLink) =>
  `- [${link.name.replace(/[[\]]/g, "")}](${link.url})${link.note ? `: ${link.note.replace(/\s+/g, " ").trim()}` : ""}`;

export function llmsTxt(input: {
  title: string;
  summary: string;
  paragraphs: string[];
  sections: LlmsSection[];
  optional?: LlmsLink[];
}): string {
  const parts = [
    `# ${input.title}`,
    `> ${input.summary.replace(/\s+/g, " ").trim()}`,
    ...input.paragraphs,
    ...input.sections
      .filter((section) => section.links.length)
      .map((section) => `## ${section.title}\n\n${section.links.map(line).join("\n")}`),
    ...(input.optional?.length ? [`## Optional\n\n${input.optional.map(line).join("\n")}`] : []),
  ];
  return `${parts.join("\n\n")}\n`;
}

/** llms.txt followed by the full documents, each under its own H1 with its URL and facts. */
export function llmsFullTxt(head: string, documents: LlmsDocument[]): string {
  const body = documents.map((doc) =>
    [`# ${doc.title}`, [`URL: ${doc.url}`, ...doc.facts].join("  \n"), doc.markdown]
      .filter(Boolean)
      .join("\n\n"),
  );
  return [head.trimEnd(), ...body].join("\n\n---\n\n") + "\n";
}
