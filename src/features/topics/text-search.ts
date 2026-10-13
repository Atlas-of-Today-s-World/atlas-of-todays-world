/**
 * Full-text search inside the topics (Topics page): every chapter and every
 * topic's introduction is one searchable part. Postgres matches, ranks and
 * cuts the excerpt (`search_topics()`, migration 20261013000010); this module
 * holds the rules the browser and the API route share:
 *
 * - case and the common accents don't matter ("Cote" finds "Côte");
 * - every word of the query (at least 2 characters, at most 8) must start a
 *   word of the part (title or text);
 * - the excerpt marks every word that starts with one of the query words.
 */

export interface ExcerptSegment {
  text: string;
  match: boolean;
}

export interface TopicHit {
  slug: string;
  topicTitle: string;
  heading: string;
  /** Chapter anchor on the topic page (`topic-2`), null for the introduction. */
  anchor: string | null;
  excerpt: ExcerptSegment[];
  score: number;
}

const MAX_WORDS = 8;

/** Letters NFD doesn't take apart, folded as the database's fold_text() does. */
const UNDECOMPOSED: Record<string, string> = { đ: "d", ł: "l", ø: "o", ı: "i" };

/** Lowercase without accents, one output character per input character (indexes line up). */
export function fold(value: string): string {
  let out = "";
  for (const char of value) {
    const lower = (char.normalize("NFD")[0] ?? char).toLowerCase();
    const base = UNDECOMPOSED[lower] ?? lower;
    out += base.length === char.length ? base : char.length === 1 ? (base[0] ?? char) : char;
  }
  return out;
}

/** Query → folded words (at least 2 characters), at most a few — as `search_words()`. */
export function queryWords(query: string): string[] {
  const words = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);
  return [...new Set(words)].slice(0, MAX_WORDS);
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Plain text → segments, every word that starts with one of `words` marked. */
export function markHits(text: string, words: readonly string[]): ExcerptSegment[] {
  const folded = fold(text);
  // The longest word first, so "rout routes" marks the whole "routes".
  const longestFirst = [...words].sort((a, b) => b.length - a.length);
  const segments: ExcerptSegment[] = [];
  let plain = 0;
  let at = 0;
  while (at < text.length) {
    // A hit starts a word: the character before it is no letter or digit.
    const word = WORD_CHAR.test(folded[at - 1] ?? "")
      ? undefined
      : longestFirst.find((candidate) => folded.startsWith(candidate, at));
    if (!word) {
      at++;
      continue;
    }
    if (at > plain) segments.push({ text: text.slice(plain, at), match: false });
    segments.push({ text: text.slice(at, at + word.length), match: true });
    at += word.length;
    plain = at;
  }
  if (plain < text.length) segments.push({ text: text.slice(plain), match: false });
  return segments;
}
