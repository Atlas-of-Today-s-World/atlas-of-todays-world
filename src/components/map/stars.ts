/**
 * Stars behind the globe (Starfield.tsx): a fixed pseudo-random sky, the same
 * on every visit and every render. Positions are fractions of the field, so
 * star N keeps its place when the window is resized — a bigger window only
 * adds stars at the end of the same sequence.
 */
export type Star = {
  /** Position as a fraction of the field width / height (0–1). */
  x: number;
  y: number;
  /** Radius in CSS pixels. */
  r: number;
  /** Opacity 0–1. */
  alpha: number;
  /** "r, g, b" — most stars white, some faintly blue or warm. */
  rgb: string;
};

/** Stars per CSS px² — about 600 on a 1440×900 screen: present, never busy. */
const DENSITY = 1 / 2200;
const MAX_STARS = 2400;
const SEED = 0x51a7;
const TINTS = ["255, 255, 255", "255, 255, 255", "255, 255, 255", "205, 220, 255", "255, 236, 214"];

/** mulberry32: a tiny seeded PRNG (Math.random can't be repeated). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The stars for a field of `width` × `height` CSS pixels. */
export function generateStars(width: number, height: number, seed = SEED): Star[] {
  const count = Math.min(MAX_STARS, Math.round(Math.max(0, width * height) * DENSITY));
  const next = random(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const x = next();
    const y = next();
    // Cubed: the vast majority are faint specks, a handful are bright.
    const size = next() ** 3;
    stars.push({
      x,
      y,
      r: 0.35 + size * 1.15,
      alpha: 0.18 + size * 0.62 + next() * 0.15,
      rgb: TINTS[Math.floor(next() * TINTS.length)] ?? "255, 255, 255",
    });
  }
  return stars;
}

/** A few stars that breathe slowly (CSS only); positions in % of the field. */
export const TWINKLES: ReadonlyArray<{ left: number; top: number; delay: number }> = (() => {
  const next = random(SEED + 1);
  return Array.from({ length: 9 }, () => ({
    left: Math.round(next() * 1000) / 10,
    top: Math.round(next() * 1000) / 10,
    delay: Math.round(next() * 60) / 10,
  }));
})();
