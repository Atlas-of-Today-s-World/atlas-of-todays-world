export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

/** HTML článku → odstavce prostého textu (pro porovnání verzí). */
export function paragraphs(html: string): string[] {
  return html
    .replace(/<\/(p|h[2-4]|li|blockquote|figcaption)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Rozdíl dvou seznamů odstavců (nejdelší společná podposloupnost). Stačí na
 * články o stovkách odstavců; schvalovatel uvidí, co přibylo a co zmizelo.
 */
export function diffParagraphs(before: string[], after: string[]): DiffPart[] {
  const rows = before.length;
  const cols = after.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i][j] =
        before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      out.push({ type: "same", text: before[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "removed", text: before[i++] });
    } else {
      out.push({ type: "added", text: after[j++] });
    }
  }
  while (i < rows) out.push({ type: "removed", text: before[i++] });
  while (j < cols) out.push({ type: "added", text: after[j++] });
  return out;
}
