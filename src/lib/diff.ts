export interface DiffPart {
  type: "same" | "added" | "removed";
  text: string;
}

/** Article HTML → plain-text paragraphs (for comparing versions). */
export function paragraphs(html: string): string[] {
  let text = html.replace(/<\/(p|h[2-4]|li|blockquote|figcaption)>/gi, "\n");
  // Repeat while something changes — otherwise "<<b>i>" would leave a tag behind.
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  // The output is plain text for comparison (React escapes it); &amp; goes last
  // so that "&amp;lt;" is not decoded twice.
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
 * Difference of two paragraph lists (longest common subsequence). Good enough for
 * articles of hundreds of paragraphs; the approver sees what was added and removed.
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
