"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/cn";

/**
 * Modal dialog on the native <dialog>: focus stays inside, Esc closes, focus
 * returns to the trigger. Content is mounted only while open, so a form in it
 * starts empty every time.
 */
export function Dialog({
  title,
  description,
  trigger,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  trigger: (open: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {trigger(() => setOpen(true))}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className={cn(
          "m-auto w-[min(92vw,26rem)] rounded-2xl p-6 text-[var(--color-ink)] scheme-light backdrop:bg-black/40",
          className,
        )}
      >
        {open ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="font-display text-[18px] font-bold">
                {title}
              </h2>
              <Button
                variant="quiet"
                size="denseIcon"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="-mt-1 -mr-2 shrink-0"
              >
                <X aria-hidden className="size-4" />
              </Button>
            </div>
            {description ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
                {description}
              </p>
            ) : null}
            {children(() => setOpen(false))}
          </>
        ) : null}
      </dialog>
    </>
  );
}
