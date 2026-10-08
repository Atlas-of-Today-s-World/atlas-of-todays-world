/**
 * `behavior` for `scrollIntoView` / `scrollTo`: smooth, unless the visitor
 * prefers reduced motion — an explicit "smooth" overrides the CSS rule that
 * turns animations off, so scripts have to ask themselves.
 */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
