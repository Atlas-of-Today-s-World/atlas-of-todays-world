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

/** Opakovatelná „náhoda" pro testy (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const all = shapes as CountryShape[];

describe("obrysy", () => {
  it("je jich 50, různých a s cestou v rámečku 100 × 100", () => {
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
  it("deset různých států, každý se čtyřmi různými možnostmi včetně správné", () => {
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

  it("špatné možnosti jsou přednostně ze stejného kontinentu", () => {
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

  it("každá hra je jiná a správná odpověď není pořád na stejném místě", () => {
    const first = newGame(all, seeded(1)).map((q) => q.answer.iso3);
    const second = newGame(all, seeded(2)).map((q) => q.answer.iso3);
    expect(first).not.toEqual(second);
    const positions = newGame(all, seeded(3)).map((q) => q.options.indexOf(q.answer));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });

  it("odmítne příliš málo států", () => {
    expect(() => newGame(all.slice(0, 5))).toThrow();
  });
});

describe("shuffle a verdict", () => {
  it("shuffle nemění vstup a zachová prvky", () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input, seeded(4));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...output].sort()).toEqual(input);
  });

  it("hodnocení pokryje 0 až 10 bodů", () => {
    for (let score = 0; score <= QUESTIONS_PER_GAME; score++) {
      expect(verdict(score).length).toBeGreaterThan(0);
    }
    expect(verdict(10)).not.toBe(verdict(9));
  });
});
