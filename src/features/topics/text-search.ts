/**
 * Full-text search inside the topics (Topics page): every chapter and every
 * topic's introduction is one searchable part. Pure, so it runs on cached
 * plain text on the server and a unit test pins the rules:
 *
 * - case and accents don't matter ("Cote" finds "Côte");
 * - every word of the query must occur in the part (title or text);
 * - the excerpt is cut around the first hit and marks every hit.
 */

interface TopicTextPart {
  /** Chapter anchor on the topic page (`topic-2`), null for the introduction. */
  anchor: string | null;
  heading: string;
  /** Plain text (tags stripped). */
  text: string;
}

export interface TopicText {
  slug: string;
  title: string;
  parts: TopicTextPart[];
}

export interface ExcerptSegment {
  text: string;
  match: boolean;
}

export interface TopicHit {
  slug: string;
  topicTitle: string;
  heading: string;
  anchor: string | null;
  excerpt: ExcerptSegment[];
  score: number;
}

const MAX_WORDS = 8;
const BEFORE = 80;
const LENGTH = 260;

/** Lowercase without accents, one output character per input character (indexes line up). */
export function fold(value: string): string {
  let out = "";
  for (const char of value) {
    const base = (char.normalize("NFD")[0] ?? char).toLowerCase();
    out += base.length === char.length ? base : char.length === 1 ? (base[0] ?? char) : char;
  }
  return out;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Sanitized HTML → readable plain text. */
export function htmlToText(html: string): string {
  let text = html.replace(/<(br|\/p|\/li|\/h[1-6]|\/blockquote)\b[^>]*>/gi, " ");
  // Strip tags until none is left (removing one can't join two halves into a new
  // tag), then drop any stray angle bracket: the result is plain text, never markup.
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text.replace(/<[^<>]*>/g, "");
  }
  return text
    .replace(/[<>]/g, "")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X"))
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Query → folded words (at least 2 characters), at most a few. */
export function queryWords(query: string): string[] {
  const words = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);
  return [...new Set(words)].slice(0, MAX_WORDS);
}

function count(haystack: string, word: string): number {
  let total = 0;
  for (let at = haystack.indexOf(word); at !== -1; at = haystack.indexOf(word, at + word.length))
    total++;
  return total;
}

/** Excerpt around the first hit, cut at word boundaries, with every hit marked. */
export function excerpt(text: string, words: readonly string[]): ExcerptSegment[] {
  const folded = fold(text);
  const first = Math.min(
    ...words.map((word) => folded.indexOf(word)).filter((at) => at !== -1),
    text.length,
  );
  let start = first === text.length ? 0 : Math.max(0, first - BEFORE);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    start = space !== -1 && space < first ? space + 1 : start;
  }
  let end = Math.min(text.length, start + LENGTH);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    end = space > first ? space : end;
  }

  const piece = text.slice(start, end);
  const foldedPiece = folded.slice(start, end);
  const segments: ExcerptSegment[] = [];
  let at = 0;
  while (at < piece.length) {
    let next = -1;
    let length = 0;
    for (const word of words) {
      const found = foldedPiece.indexOf(word, at);
      if (found !== -1 && (next === -1 || found < next)) {
        next = found;
        length = word.length;
      }
    }
    if (next === -1) {
      segments.push({ text: piece.slice(at), match: false });
      break;
    }
    if (next > at) segments.push({ text: piece.slice(at, next), match: false });
    segments.push({ text: piece.slice(next, next + length), match: true });
    at = next + length;
  }
  if (start > 0) segments.unshift({ text: "… ", match: false });
  if (end < text.length) segments.push({ text: " …", match: false });
  return segments;
}

/** Parts that contain every word of the query, best first. */
export function searchTopicTexts(
  topics: readonly TopicText[],
  query: string,
  limit = 30,
): TopicHit[] {
  const words = queryWords(query);
  if (!words.length) return [];

  const hits: TopicHit[] = [];
  for (const topic of topics) {
    for (const part of topic.parts) {
      const heading = fold(part.heading);
      const body = fold(part.text);
      if (!words.every((word) => heading.includes(word) || body.includes(word))) continue;
      const score = words.reduce(
        (total, word) => total + count(body, word) + (heading.includes(word) ? 5 : 0),
        0,
      );
      hits.push({
        slug: topic.slug,
        topicTitle: topic.title,
        heading: part.heading,
        anchor: part.anchor,
        excerpt: excerpt(part.text, words),
        score,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
