/**
 * Keeps MapLibre's compact attribution folded to its ⓘ button: MapLibre opens
 * it by itself the first time the imagery credits arrive, so that one opening
 * is undone. The reader still opens it with a click.
 */
export function foldAttribution(container: HTMLElement) {
  const attribution = container.querySelector(".maplibregl-ctrl-attrib");
  if (!attribution) return;
  const collapse = new MutationObserver(() => {
    if (!attribution.classList.contains("maplibregl-compact-show")) return;
    attribution.classList.remove("maplibregl-compact-show");
    attribution.removeAttribute("open");
    collapse.disconnect();
  });
  collapse.observe(attribution, { attributes: true, attributeFilter: ["class"] });
}
