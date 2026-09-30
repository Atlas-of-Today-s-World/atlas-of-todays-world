import { cva } from "class-variance-authority";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Formulářová primitiva administrace (ARCHITEKTURA 15.1, D7): jeden vzhled
 * ovládacích prvků a jeden `FormField` (popisek + prvek + nápověda + chyba ze Zod).
 */
export const control = cva(
  "w-full rounded-lg border border-[var(--color-line)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-soft)] focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-red-500",
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
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-[var(--color-ink-muted)]">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-[12px] text-red-700">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** aria atributy, které propojí prvek s nápovědou a chybou z FormField. */
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
