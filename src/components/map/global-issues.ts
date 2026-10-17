import type { ExpressionSpecification } from "maplibre-gl";
import { THEME_COLORS } from "@/config/palette";
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
 * A region's or a country's pill: the progress mark before the number — a
 * check mark when the region is completed, a calendar while it is planned.
 * `completed` tests the feature (its ISO3 or slug among the completed ones).
 */
export function withProgressMark(
  text: ExpressionSpecification,
  completed: ExpressionSpecification,
): ExpressionSpecification {
  return [
    "format",
    ["image", ["case", completed, STATUS_IMAGES.completed, STATUS_IMAGES.planned]],
    { "vertical-align": "center" },
    text,
    {},
  ] as unknown as ExpressionSpecification;
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
