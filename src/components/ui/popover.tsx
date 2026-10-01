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

const GAP_PX = 4;
const EDGE_PX = 8;

export interface PopoverTriggerProps {
  id: string;
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  "aria-haspopup": "dialog";
  onClick: () => void;
}

/**
 * Small non-modal popover (column filter, Columns, Export). Rendered into
 * <body> with fixed position, so a scrolling table does not clip it.
 * Keyboard: the trigger toggles it, focus moves into the panel, Esc closes
 * and returns focus to the trigger; a click outside closes it.
 */
export function Popover({
  label,
  trigger,
  children,
  align = "start",
  className,
}: {
  /** Accessible name of the panel (role="dialog"). */
  label: string;
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  className?: string;
}) {
  const id = useId();
  const triggerId = `${id}-trigger`;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Focus goes back to the trigger by id: a ref read here would be a ref read
  // during render for the React Compiler (the callback is handed to children).
  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      setPosition(null);
      if (returnFocus) document.getElementById(triggerId)?.focus();
    },
    [triggerId],
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
      ?.querySelector<HTMLElement>("input, select, textarea, button, [href], [tabindex]")
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
      }
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
  }, [open, close, place]);

  return (
    <>
      <span ref={anchor} className="inline-flex">
        {trigger({
          id: triggerId,
          "aria-expanded": open,
          "aria-controls": open ? id : undefined,
          "aria-haspopup": "dialog",
          onClick: () => (open ? close() : setOpen(true)),
        })}
      </span>
      {open
        ? createPortal(
            <div
              ref={panel}
              id={id}
              role="dialog"
              aria-label={label}
              style={position ?? { top: 0, left: 0, visibility: "hidden" }}
              className={cn(
                "fixed z-50 w-64 rounded-xl border border-[var(--color-line)] bg-white p-2 text-[13px] text-[var(--color-ink)] scheme-light shadow-lg",
                className,
              )}
            >
              {typeof children === "function" ? children(() => close()) : children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
