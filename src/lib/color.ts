/** Map colors: saturation adjustment according to the site theme (site_theme.saturation). */

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const channel = (t: number) => {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    const v =
      x < 1 / 6
        ? p + (q - p) * 6 * x
        : x < 1 / 2
          ? q
          : x < 2 / 3
            ? p + (q - p) * (2 / 3 - x) * 6
            : p;
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  if (s === 0) {
    const grey = channel(l);
    return `#${grey}${grey}${grey}`;
  }
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`;
}

/** Multiplies a color's saturation (1 = unchanged, 0 = grey); invalid input is returned as is. */
export function saturate(hex: string, factor: number): string {
  if (factor === 1 || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, Math.min(1, Math.max(0, s * factor)), l);
}

/** Same for a whole ISO3 → color map. */
export function saturateMap(colors: Record<string, string>, factor: number) {
  if (factor === 1) return colors;
  return Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, saturate(v, factor)]));
}
