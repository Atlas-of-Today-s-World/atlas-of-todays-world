"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions";

/**
 * Field errors of a public form whose Server Action returns message codes
 * (`invalidCodes`): each field's first code as text, whether any field has one,
 * and a ref for the form that moves focus to the first invalid control after
 * every rejected submit, so the reader hears the error tied to it (WCAG 3.3.1).
 */
export function useFormErrors(state: ActionState, text: (code: string) => string | undefined) {
  const form = useRef<HTMLFormElement>(null);
  const hasFieldErrors = Object.values(state.fieldErrors ?? {}).some((codes) => codes?.length);

  useEffect(() => {
    if (!hasFieldErrors) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state, hasFieldErrors]);

  const errorsOf = (field: string) => {
    const code = state.fieldErrors?.[field]?.[0];
    const message = code ? text(code) : undefined;
    return message ? [message] : undefined;
  };
  return { form, hasFieldErrors, errorsOf };
}
