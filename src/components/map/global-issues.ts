import type { ExpressionSpecification } from "maplibre-gl";
import { ROUTE_PREFIX, segmentAfter } from "@/config/routes";
import { splitLocale, withoutDefaultPrefix } from "@/features/i18n/config";
import type { ContentStatus } from "@/features/geography/content-status";

/**
 * Globe helpers for the Global issues layer and for the content status of
 * groups (regions and issues). Pure, so the expressions the globe hands to
 * MapLibre are pinned by unit tests; the drawing of the marks needs a canvas.
 */

/** Slug of the global issue whose panel is open (`/global-issue/<slug>` in any language). */
export function openIssueSlug(pathname: string): string | undefined {
  return segmentAfter(splitLocale(withoutDefaultPrefix(pathname)).path, ROUTE_PREFIX.issue);
}

/** Images of the status marks inside a topic-count pill (drawn on `styleimagemissing`). */
export const STATUS_IMAGES = {
  ready: "topic-status-ready",
  preparing: "topic-status-preparing",
  // An empty pixel: a format section needs some image, even where there's no mark.
  none: "topic-status-none",
} as const satisfies Record<ContentStatus, string>;

const STATUS_BY_IMAGE = new Map<string, ContentStatus>(
  Object.entries(STATUS_IMAGES).map(([status, image]) => [image, status as ContentStatus]),
);

/** Group slug → its status (`bySlug` of a globe lookup). */
export function statusesOf(groups: Record<string, { status: ContentStatus }>) {
  return Object.fromEntries(
    Object.entries(groups).map(([slug, group]) => [slug, group.status]),
  ) as Record<string, ContentStatus>;
}

/**
 * The pill's text with the group's status mark after the number: a check mark
 * for ready content, an hourglass for content in preparation. Without any
 * started group the plain text stays (no format sections to lay out).
 */
export function withStatusMark(
  text: ExpressionSpecification,
  statuses: Record<string, ContentStatus>,
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
 * A status mark as a MapLibre image, or null for an unknown id. A round dot
 * that reads on the white pill and on the soft dark one, with a transparent
 * gap on the left so it doesn't touch the number.
 */
export function statusMarkImage(id: string) {
  const status = STATUS_BY_IMAGE.get(id);
  if (!status) return null;
  // Drawn at 4× for sharp edges on dense screens; laid out at its logical size
  // (inline images aren’t scaled with the text): a dot a little taller than the digits.
  const ratio = 4;
  const [w, h, gap] = status === "none" ? [1, 1, 0] : [14 * ratio, 11 * ratio, 3 * ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (status !== "none") {
    const r = h / 2 - ratio / 2;
    const [cx, cy] = [gap + (w - gap) / 2, h / 2];
    ctx.fillStyle = status === "ready" ? "#1e9e5a" : "#d98a00";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 1.5 * ratio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (status === "ready") {
      ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
      ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
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
  }
  return { image: ctx.getImageData(0, 0, w, h), options: { pixelRatio: ratio } };
}
