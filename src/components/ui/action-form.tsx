"use client";

import { createContext, useContext, useTransition, type FormHTMLAttributes } from "react";

const Pending = createContext(false);

/** Probíhá odeslání nejbližšího <ActionForm>? (pro SubmitButton) */
export const useActionPending = () => useContext(Pending);

/**
 * Formulář pro Server Action přes `useActionState` (ARCHITEKTURA 15.1).
 *
 * Proč ne `<form action={…}>`: React 19 po každé akci formulář resetuje —
 * i když validace neprošla, takže by uživatel přišel o vše, co napsal.
 * Tady se odesílá přes onSubmit v transition a pole zůstanou vyplněná.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter);
        start(() => action(data));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
    </form>
  );
}
