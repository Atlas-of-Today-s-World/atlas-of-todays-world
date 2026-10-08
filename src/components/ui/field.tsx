import { cva } from "class-variance-authority";
import {
  cloneElement,
  isValidElement,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Admin form primitives (ARCHITEKTURA 15.1, D7): one look for
 * controls and one `FormField` (label + control + hint + error from Zod).
 */
const control = cva(
  "w-full rounded-lg border border-[var(--color-field-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-[var(--color-danger)]",
  {
    variants: {
      kind: {
        input: "min-h-(--touch-min)",
        textarea: "min-h-28 py-2.5 leading-relaxed",
        select: "min-h-(--touch-min) pr-8",
      },
    },
    defaultVariants: { kind: "input" },
  },
);

export function FormField({
  id,
  label,
  hint,
  errors,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  // A required field says so to assistive tech too (the "*" is only visual),
  // unless the control already carries `required` / `aria-required` itself.
  const control =
    required &&
    isValidElement<{ required?: boolean; "aria-required"?: boolean }>(children) &&
    children.props.required === undefined &&
    children.props["aria-required"] === undefined
      ? cloneElement(children, { "aria-required": true })
      : children;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
        {label}
        {required ? (
          <span aria-hidden className="text-[var(--color-danger)]">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-[var(--color-ink-muted)]">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-[12px] text-[var(--color-danger)]">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What the "*" next to a label means. With `onlyWithRequiredFields` it shows
 * only on a page that has a required field (CSS :has), so a layout can render
 * it once for every screen.
 */
export function RequiredNote({
  label = "Required field",
  onlyWithRequiredFields = false,
  className,
}: {
  label?: string;
  onlyWithRequiredFields?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[12px] text-[var(--color-ink-muted)]",
        onlyWithRequiredFields && "hidden [main:has([aria-required=true],[required])_&]:block",
        className,
      )}
    >
      <span aria-hidden className="text-[var(--color-danger)]">
        *
      </span>{" "}
      {label}
    </p>
  );
}

/** aria attributes that link the control with the hint and error from FormField. */
export function describedBy(id: string, { hint, errors }: { hint?: string; errors?: string[] }) {
  const ids = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean);
  return {
    "aria-describedby": ids.length ? ids.join(" ") : undefined,
    "aria-invalid": errors?.length ? true : undefined,
  };
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control({ kind: "input" }), className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control({ kind: "textarea" }), className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control({ kind: "select" }), className)} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-(--touch-min) cursor-pointer items-center gap-2.5 text-[13.5px]",
        className,
      )}
    >
      <input type="checkbox" className="size-4 accent-[var(--color-accent)]" {...props} />
      {label}
    </label>
  );
}
