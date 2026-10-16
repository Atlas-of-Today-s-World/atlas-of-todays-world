import { Download, FileText, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { skillLinks } from "../model";

const LINK = buttonVariants({ variant: "outline", size: "chip" });

/**
 * The links of one skill: its raw SKILL.md, the ZIP and the GitHub editor.
 * Plain <a>, not the router's Link: they lead to files, not pages. `children`
 * go first (the index adds "Read").
 */
export function SkillActions({ name, children }: { name: string; children?: ReactNode }) {
  const links = skillLinks(name);
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Links of this skill">
      {children ? <li>{children}</li> : null}
      <li>
        <a href={links.raw} className={LINK}>
          <FileText aria-hidden className="size-3.5" />
          Raw SKILL.md
        </a>
      </li>
      <li>
        <a href={links.zip} download className={LINK}>
          <Download aria-hidden className="size-3.5" />
          Download ZIP
        </a>
      </li>
      <li>
        <a href={links.edit} className={LINK} target="_blank" rel="noopener noreferrer">
          <Pencil aria-hidden className="size-3.5" />
          Edit on GitHub
        </a>
      </li>
    </ul>
  );
}
