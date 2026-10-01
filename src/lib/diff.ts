export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

/** HTML článku → odstavce prostého textu (pro porovnání verzí). */
export function paragraphs(html: string): string[] {
  let text = html.replace(/<\/(p|h[2-4]|li|blockquote|figcaption)>/gi, "\n");
  // Opakovaně, dokud se něco mění — jinak by z „<<b>i>" zbyla značka.
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  // Výstup je prostý text pro porovnání (React ho escapuje); &amp; až nakonec,
  // ať se „&amp;lt;" nedekóduje dvakrát.
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
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
  const at = (r: number, c: number) => lcs[r]?.[c] ?? 0;
  for (let i = rows - 1; i >= 0; i--) {
    const row = lcs[i] ?? [];
    for (let j = cols - 1; j >= 0; j--) {
      row[j] = before[i] === after[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const out: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    const a = before[i] ?? "";
    const b = after[j] ?? "";
    if (a === b) {
      out.push({ type: "same", text: a });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      out.push({ type: "removed", text: a });
      i++;
    } else {
      out.push({ type: "added", text: b });
      j++;
    }
  }
  for (; i < rows; i++) out.push({ type: "removed", text: before[i] ?? "" });
  for (; j < cols; j++) out.push({ type: "added", text: after[j] ?? "" });
  return out;
}
