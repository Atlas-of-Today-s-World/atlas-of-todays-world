/**
 * The admin half of the custom-map slot (see map-slot.ts): the map builder.
 * Kept apart from the public slot so the carousel on public pages never pulls
 * the builder — and the rich-text editor it carries — into their bundles.
 */
/** The admin's map builder: controlled, like a form field (`value`, `onChange`). */
export { MapVisualBuilder } from "./map/components/MapVisualBuilder";
