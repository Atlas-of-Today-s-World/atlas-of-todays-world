/**
 * Kvíz na stránce 404: poznej stát podle obrysu. Čistá logika bez Reactu,
 * ať se dá otestovat se zadaným generátorem náhody.
 */

export interface CountryShape {
  iso3: string;
  name: string;
  continent: string;
  /** SVG cesta v rámečku 0 0 100 100 (scripts/build-quiz-shapes.mjs). */
  path: string;
}

export interface Question {
  answer: CountryShape;
  /** Čtyři možnosti v náhodném pořadí, jedna z nich je `answer`. */
  options: CountryShape[];
}

export const QUESTIONS_PER_GAME = 10;
export const OPTIONS_PER_QUESTION = 4;

type Random = () => number;

/** Fisher–Yates; vrací novou kopii. */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Nová hra: deset různých států v náhodném pořadí — každá návštěva jiná.
 * Špatné možnosti bere nejdřív ze stejného kontinentu, ať to není zadarmo
 * (Itálie vedle Brazílie a Japonska by se poznala i bez obrysu).
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

/** Slovní hodnocení na konci hry. */
export function verdict(score: number): string {
  if (score === QUESTIONS_PER_GAME) return "Flawless. You could draw the Atlas from memory.";
  if (score >= 8) return "Excellent — a seasoned map reader.";
  if (score >= 5) return "Not bad at all. The globe is waiting for the rest.";
  if (score >= 1) return "A start! Spin the globe and come back for a rematch.";
  return "Every explorer starts somewhere. Try another round?";
}
