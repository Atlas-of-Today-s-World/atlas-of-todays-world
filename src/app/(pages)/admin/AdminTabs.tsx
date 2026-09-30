"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Záložky administrace.
 *
 * Dřív byla celá redakce jedna dlouhá stránka a formulář nové novinky se
 * prorůstal se seznamem publikovaných. Každá oblast má teď vlastní záložku;
 * vykresluje se jen ta otevřená, takže se formuláře nepřebíjejí.
 *
 * Zvolená záložka se píše do adresy (`#zeme`), aby uložení a následné
 * `router.refresh()` nevrátilo redaktora na začátek.
 */
export interface AdminTab {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export default function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  // Hash čteme až po připojení: při vykreslení na serveru o něm nevíme a
  // rozdíl by hlásila hydratace. `hashchange` je tam kvůli odkazům a tlačítku
  // zpět – ty adresu změní, ale stránku nenačtou znovu.
  useEffect(() => {
    const ids = new Set(tabs.map((tab) => tab.id));
    const apply = () => {
      const fromHash = window.location.hash.replace("#", "");
      if (fromHash && ids.has(fromHash)) setActive(fromHash);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [tabs]);

  function open(id: string) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <>
      <div
        role="tablist"
        aria-label="Oblasti administrace"
        className="mt-8 flex flex-wrap gap-1 border-b border-[var(--color-line)]"
      >
        {tabs.map((tab) => {
          const on = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={on}
              aria-controls={`panel-${tab.id}`}
              onClick={() => open(tab.id)}
              className={`-mb-px min-h-11 rounded-t-lg border-b-2 px-4 text-[14px] transition ${
                on
                  ? "border-[var(--color-accent)] font-medium text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" ? (
                <span className="ml-1.5 text-[var(--color-ink-muted)]">
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {current ? (
        <div
          role="tabpanel"
          id={`panel-${current.id}`}
          aria-labelledby={`tab-${current.id}`}
          className="mt-8"
        >
          {current.content}
        </div>
      ) : null}
    </>
  );
}
