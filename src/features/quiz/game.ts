/**
 * Quiz on the 404 page: guess the country by its outline. Pure logic without React,
 * so it can be tested with a given random generator.
 */

import { swap } from "@/lib/array";

export interface CountryShape {
  iso3: string;
  name: string;
  continent: string;
  /** SVG path in the 0 0 100 100 box (scripts/build-quiz-shapes.mjs). */
  path: string;
}

export interface Question {
  answer: CountryShape;
  /** Four options in random order, one of which is `answer`. */
  options: CountryShape[];
}

export const QUESTIONS_PER_GAME = 10;
export const OPTIONS_PER_QUESTION = 4;

type Random = () => number;

/** Fisher–Yates; returns a new copy. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  let copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    copy = swap(copy, i, j);
  }
  return copy;
}

/**
 * New game: ten distinct countries in random order — every visit is different.
 * Wrong options come first from the same continent, so it isn't too easy
 * (Italy next to Brazil and Japan would be guessed even without the outline).
 */
export function newGame(shapes: readonly CountryShape[], random: Random = Math.random): Question[] {
  if (shapes.length < Math.max(QUESTIONS_PER_GAME, OPTIONS_PER_QUESTION)) {
    throw new Error("Not enough countries for a game.");
  }
  return shuffle(shapes, random)
    .slice(0, QUESTIONS_PER_GAME)
    .map((answer) => {
      const others = shuffle(
        shapes.filter((shape) => shape.iso3 !== answer.iso3),
        random,
      );
      const near = others.filter((shape) => shape.continent === answer.continent);
      const far = others.filter((shape) => shape.continent !== answer.continent);
      const wrong = [...near, ...far].slice(0, OPTIONS_PER_QUESTION - 1);
      return { answer, options: shuffle([answer, ...wrong], random) };
    });
}

/** Verbal rating at the end of the game. */
export function verdict(score: number): string {
  if (score === QUESTIONS_PER_GAME) return "Flawless. You could draw the Atlas from memory.";
  if (score >= 8) return "Excellent — a seasoned map reader.";
  if (score >= 5) return "Not bad at all. The globe is waiting for the rest.";
  if (score >= 1) return "A start! Spin the globe and come back for a rematch.";
  return "Every explorer starts somewhere. Try another round?";
}
