"use client";

import { useEffect } from "react";

/**
 * Expanded chapters belong in the URL (P9, `#chapter-3`): an anchor link expands
 * the matching `<details data-hash>`, and opening/closing writes it into the URL.
 * Chapter text is fully in the HTML — this is just state, nothing is fetched.
 */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const details = target?.closest<HTMLDetailsElement>("details[data-hash]");
      if (!target || !details) return;
      details.open = true;
      target.scrollIntoView({ block: "start" });
    };
    // `toggle` doesn't bubble — hence capturing on the document.
    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.hasAttribute("data-hash")) return;
      const hash = `#${details.id}`;
      if (details.open && window.location.hash !== hash) {
        history.replaceState(history.state, "", hash);
      } else if (!details.open && window.location.hash === hash) {
        history.replaceState(history.state, "", window.location.pathname + window.location.search);
      }
    };
    open();
    window.addEventListener("hashchange", open);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      window.removeEventListener("hashchange", open);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
