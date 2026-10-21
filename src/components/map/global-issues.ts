import type { ExpressionSpecification } from "maplibre-gl";
import { GLOBE_COLORS, THEME_COLORS } from "@/config/palette";
import { ROUTE_PREFIX, segmentAfter } from "@/config/routes";
import { splitLocale, withoutDefaultPrefix } from "@/lib/i18n/config";
import type { GroupStatus } from "@/features/geography/content-status";

/**
 * Globe helpers for the Global issues layer and for the content status of
 * groups (regions and issues). Pure, so the expressions the globe hands to
 * MapLibre are pinned by unit tests; the drawing of the marks needs a canvas.
 */

/** Slug of the global issue whose panel is open (`/global-issue/<slug>` in any language). */
export function openIssueSlug(pathname: string): string | undefined {
  return segmentAfter(splitLocale(withoutDefaultPrefix(pathname)).path, ROUTE_PREFIX.issue);
}

/** Images of the status marks inside a topic-count pill (added on the globe's `load`). */
export const STATUS_IMAGES = {
  ready: "topic-status-ready",
  preparing: "topic-status-preparing",
  // An empty pixel: a format section needs some image, even where there's no mark.
  none: "topic-status-none",
  // A region's progress, on its own pill and on its countries' pills.
  completed: "topic-status-completed",
  planned: "topic-status-planned",
} as const satisfies Record<GroupStatus, string>;

const STATUS_BY_IMAGE = new Map<string, GroupStatus>(
  Object.entries(STATUS_IMAGES).map(([status, image]) => [image, status as GroupStatus]),
);

/** Group slug → its status (`bySlug` of a globe lookup). */
export function statusesOf(groups: Record<string, { status: GroupStatus }>) {
  return Object.fromEntries(
    Object.entries(groups).map(([slug, group]) => [slug, group.status]),
  ) as Record<string, GroupStatus>;
}

/**
 * A global issue's pill: its text with the status mark after the number, a
 * check mark for ready content, an hourglass for content in preparation.
 * Without any started group the plain text stays (no format sections to lay out).
 */
export function withStatusMark(
  text: ExpressionSpecification,
  statuses: Record<string, GroupStatus>,
  property: "iso3" | "slug" = "slug",
): ExpressionSpecification {
  const ready = Object.keys(statuses).filter((key) => statuses[key] === "ready");
  const preparing = Object.keys(statuses).filter((key) => statuses[key] === "preparing");
  if (!ready.length && !preparing.length) return text;
  const branches = [
    ...(ready.length ? [ready, STATUS_IMAGES.ready] : []),
    ...(preparing.length ? [preparing, STATUS_IMAGES.preparing] : []),
  ];
  // MapLibre types can't express a variable number of branches in "match" or an image section.
  return [
    "format",
    text,
    {},
    ["image", ["match", ["get", property], ...branches, STATUS_IMAGES.none]],
    { "vertical-align": "center" },
  ] as unknown as ExpressionSpecification;
}

/**
 * The marks of a region's and a country's pair of pills (added on the globe's
 * `load`): a globe with a check mark or a calendar on the region pill (its
 * progress), an open book before the entries' "published / planned".
 */
export const PILL_MARKS = {
  regionCompleted: "topic-region-completed",
  regionPlanned: "topic-region-planned",
  entries: "topic-entries",
} as const;

/**
 * The region pill's content: the globe with the region's progress mark.
 * `completed` tests the feature (its ISO3 or slug among the completed ones).
 */
export function regionPillText(completed: ExpressionSpecification): ExpressionSpecification {
  return [
    "format",
    ["image", ["case", completed, PILL_MARKS.regionCompleted, PILL_MARKS.regionPlanned]],
    { "vertical-align": "center" },
  ] as unknown as ExpressionSpecification;
}

/** The entries pill's content: the book, then the text ("7/10"). */
export function entriesPillText(text: ExpressionSpecification): ExpressionSpecification {
  return [
    "format",
    ["image", PILL_MARKS.entries],
    { "vertical-align": "center" },
    text,
    {},
  ] as unknown as ExpressionSpecification;
}

/** Icon outlines (Tabler Icons, MIT; 24-unit grid, 2-unit stroke): drawn into the pill marks and the pulse. */
export const PILL_ICONS = {
  globe: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0",
    "M3.6 9h16.8",
    "M3.6 15h16.8",
    "M11.5 3a17 17 0 0 0 0 18",
    "M12.5 3a17 17 0 0 1 0 18",
  ],
  check: ["M5 12l5 5l10 -10"],
  calendar: [
    "M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z",
    "M16 3v4",
    "M8 3v4",
    "M4 11h16",
  ],
  book: [
    "M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0",
    "M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0",
    "M3 6v13",
    "M12 6v13",
    "M21 6v13",
  ],
} as const;

/**
 * A pill mark (PILL_MARKS) as a MapLibre image, or null for an unknown id.
 * Drawn at 4× and laid out at its logical size, like the status marks.
 */
export function pillMarkImage(id: string) {
  const ratio = 4;
  const region = id === PILL_MARKS.regionCompleted || id === PILL_MARKS.regionPlanned;
  if (!region && id !== PILL_MARKS.entries) return null;
  // Region: globe and mark side by side (white on the coloured pill). Entries:
  // the book in the pill's text colour, a gap before the number.
  const [w, h] = region ? [23, 12] : [14, 11];
  const canvas = document.createElement("canvas");
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const icon = (paths: readonly string[], x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.translate(x * ratio, y * ratio);
    ctx.scale((size * ratio) / 24, (size * ratio) / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    for (const path of paths) ctx.stroke(new Path2D(path));
    ctx.restore();
  };
  if (region) {
    icon(PILL_ICONS.globe, 0, 0, 12, "#ffffff");
    icon(
      id === PILL_MARKS.regionCompleted ? PILL_ICONS.check : PILL_ICONS.calendar,
      13.5,
      1.5,
      9.5,
      "#ffffff",
    );
  } else {
    icon(PILL_ICONS.book, 0, 0, 11, GLOBE_COLORS.badgeText);
  }
  return {
    image: ctx.getImageData(0, 0, canvas.width, canvas.height),
    options: { pixelRatio: ratio },
  };
}

/** ISO3 / slug among the completed places, as a MapLibre test. */
export function isCompleted(
  statuses: Record<string, GroupStatus>,
  property: "iso3" | "slug",
): ExpressionSpecification {
  const done = Object.keys(statuses).filter((key) => statuses[key] === "completed");
  return ["in", ["get", property], ["literal", done]];
}

/**
 * A status mark as a MapLibre image, or null for an unknown id.
 *
 * - an issue's mark: a coloured dot with a white check / hourglass on the white
 *   pill, a transparent gap on the left so it doesn't touch the number;
 * - a region's progress mark: a white disc with a green check / amber calendar
 *   on the coloured pill, larger, the gap on the right (it leads the number).
 */
export function statusMarkImage(id: string) {
  const status = STATUS_BY_IMAGE.get(id);
  if (!status) return null;
  // Drawn at 4× for sharp edges on dense screens; laid out at its logical size
  // (inline images aren’t scaled with the text): a dot a little taller than the digits.
  const ratio = 4;
  const progress = status === "completed" || status === "planned";
  const [w, h, gap] =
    status === "none"
      ? [1, 1, 0]
      : progress
        ? [15 * ratio, 12 * ratio, 3 * ratio]
        : [14 * ratio, 11 * ratio, 3 * ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (status === "none")
    return { image: ctx.getImageData(0, 0, w, h), options: { pixelRatio: ratio } };

  const r = h / 2 - ratio / 2;
  // The gap is on the side facing the number.
  const [cx, cy] = [progress ? (w - gap) / 2 : gap + (w - gap) / 2, h / 2];
  const tone =
    status === "ready" || status === "completed"
      ? THEME_COLORS.statusReadyText
      : THEME_COLORS.statusPreparingText;
  const dot = progress
    ? "#ffffff"
    : status === "ready"
      ? THEME_COLORS.statusReady
      : THEME_COLORS.statusPreparing;
  const ink = progress ? tone : "#ffffff";
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = (progress ? 1.7 : 1.5) * ratio;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (status === "ready" || status === "completed") {
    ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
    ctx.stroke();
  } else if (status === "planned") {
    // Calendar: a sheet with a solid top band and two rings over it.
    const [x, y, sw, sh] = [cx - r * 0.5, cy - r * 0.38, r, r * 0.9];
    ctx.lineWidth = 0.9 * ratio;
    ctx.strokeRect(x, y, sw, sh);
    ctx.fillRect(x, y, sw, sh * 0.32);
    ctx.lineWidth = 1.1 * ratio;
    ctx.beginPath();
    for (const ring of [x + sw * 0.28, x + sw * 0.72]) {
      ctx.moveTo(ring, y - r * 0.2);
      ctx.lineTo(ring, y + r * 0.08);
    }
    ctx.stroke();
  } else {
    // Hourglass: two triangles meeting in the middle, with a top and bottom bar.
    const [dx, dy] = [r * 0.42, r * 0.55];
    ctx.lineWidth = 0.9 * ratio;
    ctx.moveTo(cx - dx, cy - dy);
    ctx.lineTo(cx + dx, cy - dy);
    ctx.lineTo(cx - dx, cy + dy);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return { image: ctx.getImageData(0, 0, w, h), options: { pixelRatio: ratio } };
}
