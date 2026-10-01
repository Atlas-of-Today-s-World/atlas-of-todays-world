"use client";

import { useEffect } from "react";

/**
 * Rozbalené kapitoly patří do adresy (P9, `#chapter-3`): odkaz s kotvou
 * rozbalí příslušný `<details data-hash>` a otevření/zavření ho do adresy
 * zapíše. Text kapitol je celý v HTML — tohle je jen stav, nic se nedotahuje.
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
    // `toggle` nebublá — proto zachytávání na dokumentu.
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
