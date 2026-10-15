"use client";

import { Circle } from "lucide-react";
import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { MAP_ICON_GROUPS, type MapIconName } from "../../icon-names";
import { MAP_ICONS } from "../../icons";

const words = (name: string) => name.replaceAll("-", " ");

/**
 * Picks one of the curated map icons (or none): a button showing the current
 * choice opens a panel with a search and the icons by group.
 */
export function IconPicker({
  value,
  onChange,
  noneLabel,
  label = "Icon",
}: {
  value: MapIconName | null;
  onChange: (icon: MapIconName | null) => void;
  /** What "no icon" means here ("Plain circle", "Colour only"). */
  noneLabel: string;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const q = query.trim().toLowerCase();
  const Current = value ? MAP_ICONS[value] : Circle;
  return (
    <Popover
      label={`${label}: choose`}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
      className="w-[min(22rem,calc(100vw-2rem))]"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-start")}
        >
          <Current size={16} aria-hidden />
          <span>
            {label}: {value ? words(value) : noneLabel}
          </span>
        </button>
      )}
    >
      {(close) => {
        const pick = (icon: MapIconName | null) => {
          onChange(icon);
          close();
        };
        return (
          <div className="grid gap-2 p-2">
            <label className="sr-only" htmlFor={searchId}>
              Search icons
            </label>
            <Input
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search icons…"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => pick(null)}
              aria-pressed={value === null}
              className={cn(
                buttonVariants({ variant: "quiet", size: "dense" }),
                "justify-start",
                value === null && "bg-[var(--color-accent-soft)]",
              )}
            >
              <Circle size={16} aria-hidden /> {noneLabel}
            </button>
            <div className="grid max-h-72 gap-2 overflow-auto">
              {Object.entries(MAP_ICON_GROUPS).map(([group, names]) => {
                const shown = (names as readonly MapIconName[]).filter(
                  (name) => !q || words(name).includes(q) || group.toLowerCase().includes(q),
                );
                if (!shown.length) return null;
                return (
                  <fieldset key={group}>
                    <legend className="mb-1 text-[11.5px] font-semibold text-[var(--color-ink-muted)]">
                      {group}
                    </legend>
                    <div className="grid grid-cols-7 gap-1">
                      {shown.map((name) => {
                        const Icon = MAP_ICONS[name];
                        return (
                          <button
                            key={name}
                            type="button"
                            title={words(name)}
                            aria-label={words(name)}
                            aria-pressed={value === name}
                            onClick={() => pick(name)}
                            className={cn(
                              "grid size-(--touch-min) place-items-center rounded-lg text-[var(--color-ink-soft)] transition hover:bg-[var(--color-line)]/50 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]",
                              value === name &&
                                "bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]",
                            )}
                          >
                            <Icon size={18} aria-hidden />
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        );
      }}
    </Popover>
  );
}
