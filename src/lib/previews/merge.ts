/**
 * Puts the preview images a save found ({ link → image }, ActionState.previews)
 * into an editor's list, where a link still has no image — so the form shows
 * them right away and the next save sends them back instead of dropping them.
 */
export function withPreviews<T extends { url?: string; image_url?: string }>(
  items: readonly T[],
  previews: Record<string, string> | undefined,
): T[] {
  if (!previews) return [...items];
  return items.map((item) =>
    !item.image_url && item.url && Object.hasOwn(previews, item.url)
      ? { ...item, image_url: previews[item.url] }
      : item,
  );
}
