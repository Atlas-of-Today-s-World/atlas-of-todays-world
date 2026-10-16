/**
 * The admin half of the custom-map slot (see map-slot.ts): the map builder.
 * Kept apart from the public slot so the carousel on public pages never pulls
 * the builder — and the rich-text editor it carries — into their bundles.
 */
/**
 * The admin's map builder: controlled, like a form field (`value`, `onChange`;
 * `saved`: the view as last saved, for "Reset to saved view").
 */
export { MapVisualBuilder } from "./map/components/MapVisualBuilder";
/** Points without a title: the form says so before it sends a map the server refuses. */
export { untitledPoints } from "./map/builder-state";
