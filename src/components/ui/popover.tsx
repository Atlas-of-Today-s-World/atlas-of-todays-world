"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useLatest } from "@/lib/use-latest";

const GAP_PX = 4;
const EDGE_PX = 8;
const MENU_ITEM = '[role="menuitem"]';
const MODAL = '[aria-modal="true"]';

type PopoverRole = "dialog" | "menu";

export interface PopoverTriggerProps {
  id: string;
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  "aria-haspopup": PopoverRole;
  onClick: () => void;
}

/**
 * Small non-modal popover (column filter, Columns, Export, the header's
 * account menu). Rendered into <body> with fixed position, so a scrolling
 * table does not clip it. Keyboard: the trigger toggles it, focus moves into
 * the panel, Esc closes and returns focus to the trigger; a click outside
 * closes it.
 *
 * `role="menu"`: an actions menu (WAI-ARIA menu button) — the items are
 * elements with `role="menuitem"`; ↑/↓ move between them (wrapping), Home/End
 * jump to the first/last, Tab closes the menu back to its button. Items that
 * appear later (loaded on open) take focus with `focusFirstMenuItem`.
 */
export function Popover({
  label,
  trigger,
  children,
  align = "start",
  role = "dialog",
  onOpenChange,
  className,
}: {
  /** Accessible name of the panel. */
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  role?: PopoverRole;
  /** Told when the panel opens or closes (e.g. to load its content on open). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Latest callback without re-running the open effect (which moves focus) on each render.
  const openChange = useLatest(onOpenChange);

  // Focus goes back to the trigger by id: a ref read here would be a ref read
  // during render for the React Compiler (the callback is handed to children).
  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      setPosition(null);
      openChange.current?.(false);
      if (returnFocus) document.getElementById(triggerId)?.focus();
    },
    [triggerId, openChange],
  );

  const place = useCallback(() => {
    const box = anchor.current?.getBoundingClientRect();
    const width = panel.current?.offsetWidth ?? 0;
    const height = panel.current?.offsetHeight ?? 0;
    if (!box) return;
    const maxLeft = window.innerWidth - width - EDGE_PX;
    const left = Math.max(
      EDGE_PX,
      Math.min(align === "end" ? box.right - width : box.left, maxLeft),
    );
    const below = box.bottom + GAP_PX;
    const top =
      below + height > window.innerHeight - EDGE_PX && box.top - GAP_PX - height > EDGE_PX
        ? box.top - GAP_PX - height
        : below;
    setPosition({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    panel.current
      ?.querySelector<HTMLElement>(
        role === "menu" ? MENU_ITEM : "input, select, textarea, button, [href], [tabindex]",
      )
      ?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (role === "menu" && panel.current) moveInMenu(event, panel.current, close);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, close, place, role]);

  return (
    <>
      <span ref={anchor} className="inline-flex">
        {trigger({
          id: triggerId,
          "aria-expanded": open,
          "aria-controls": open ? id : undefined,
          "aria-haspopup": role,
          onClick: () => {
            if (open) return close();
            // A menu opened inside a modal dialog (the mobile site menu) goes into
            // that dialog: aria-modal hides everything outside it from screen
            // readers. The dialog fills the screen, so the fixed position holds.
            const modal = document.getElementById(triggerId)?.closest<HTMLElement>(MODAL);
            setHost(role === "menu" ? (modal ?? null) : null);
            setOpen(true);
            openChange.current?.(true);
          },
        })}
      </span>
      {open
        ? createPortal(
            <div
              ref={panel}
              id={id}
              role={role}
              aria-label={label}
              style={position ?? { top: 0, left: 0, visibility: "hidden" }}
              className={cn(
                "z-overlay fixed w-64 rounded-xl border border-[var(--color-line)] bg-white p-2 text-[13px] text-[var(--color-ink)] scheme-light shadow-lg",
                className,
              )}
            >
              {typeof children === "function" ? children(() => close()) : children}
            </div>,
            host ?? document.body,
          )
        : null}
    </>
  );
}

/** Arrow keys, Home/End and Tab inside an open menu (see Popover). */
function moveInMenu(event: KeyboardEvent, menu: HTMLElement, close: () => void) {
  if (event.key === "Tab") {
    // Tab leaves a menu: back to its button, never on past the end of <body>.
    event.preventDefault();
    close();
    return;
  }
  const items = [...menu.querySelectorAll<HTMLElement>(MENU_ITEM)];
  if (!items.length) return;
  const current = items.indexOf(document.activeElement as HTMLElement);
  const last = items.length - 1;
  const next =
    event.key === "ArrowDown"
      ? current < 0 || current === last
        ? 0
        : current + 1
      : event.key === "ArrowUp"
        ? current <= 0
          ? last
          : current - 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : null;
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
}

/** Moves focus to the first item of the menu `inside` belongs to (items loaded after opening). */
export function focusFirstMenuItem(inside: HTMLElement | null) {
  inside?.closest('[role="menu"]')?.querySelector<HTMLElement>(MENU_ITEM)?.focus();
}
