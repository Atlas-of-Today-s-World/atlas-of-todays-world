import { describe, expect, it } from "vitest";
import shapes from "./shapes.generated.json";
import {
  newGame,
  OPTIONS_PER_QUESTION,
  QUESTIONS_PER_GAME,
  shuffle,
  verdict,
  type CountryShape,
} from "./game";

/** Repeatable "randomness" for tests (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const all = shapes as CountryShape[];

describe("outlines", () => {
  it("there are 50, distinct, with a path in the 100 × 100 box", () => {
    expect(all).toHaveLength(50);
    expect(new Set(all.map((shape) => shape.iso3)).size).toBe(50);
    for (const shape of all) {
      expect(shape.path.startsWith("M") && shape.path.endsWith("Z")).toBe(true);
      expect(shape.path).not.toMatch(/[^MLZ\d. ]/);
      const numbers = shape.path
        .split(/[MLZ ]/)
        .filter(Boolean)
        .map(Number);
      expect(Math.max(...numbers)).toBeLessThanOrEqual(100);
    }
  });
});

describe("newGame", () => {
  it("ten distinct countries, each with four distinct options including the right one", () => {
    const game = newGame(all, seeded(1));
    expect(game).toHaveLength(QUESTIONS_PER_GAME);
    expect(new Set(game.map((q) => q.answer.iso3)).size).toBe(QUESTIONS_PER_GAME);
    for (const question of game) {
      const ids = question.options.map((option) => option.iso3);
      expect(ids).toHaveLength(OPTIONS_PER_QUESTION);
      expect(new Set(ids).size).toBe(OPTIONS_PER_QUESTION);
      expect(ids.filter((iso3) => iso3 === question.answer.iso3)).toHaveLength(1);
    }
  });

  it("wrong options preferably come from the same continent", () => {
    for (const question of newGame(all, seeded(7))) {
      const sameContinent = all.filter(
        (shape) => shape.continent === question.answer.continent && shape !== question.answer,
      ).length;
      const near = question.options.filter(
        (option) => option !== question.answer && option.continent === question.answer.continent,
      ).length;
      expect(near).toBe(Math.min(sameContinent, OPTIONS_PER_QUESTION - 1));
    }
  });

  it("every game differs and the right answer isn't always in the same spot", () => {
    const first = newGame(all, seeded(1)).map((q) => q.answer.iso3);
    const second = newGame(all, seeded(2)).map((q) => q.answer.iso3);
    expect(first).not.toEqual(second);
    const positions = newGame(all, seeded(3)).map((q) => q.options.indexOf(q.answer));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it("rejects too few countries", () => {
    expect(() => newGame(all.slice(0, 5))).toThrow();
  });
});

describe("shuffle and verdict", () => {
  it("shuffle doesn't mutate the input and keeps the elements", () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input, seeded(4));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...output].sort()).toEqual(input);
  });

  it("rating covers 0 to 10 points", () => {
    for (let score = 0; score <= QUESTIONS_PER_GAME; score++) {
      expect(verdict(score).length).toBeGreaterThan(0);
    }
    expect(verdict(10)).not.toBe(verdict(9));
  });
});
