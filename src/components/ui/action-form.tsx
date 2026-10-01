"use client";

import { createContext, useContext, useTransition, type FormHTMLAttributes, type Ref } from "react";

const Pending = createContext(false);

/** Is the nearest <ActionForm> submitting? (for SubmitButton) */
export const useActionPending = () => useContext(Pending);

/**
 * Form for a Server Action via `useActionState` (ARCHITEKTURA 15.1).
 *
 * Why not `<form action={…}>`: React 19 resets the form after every action —
 * even when validation failed, so the user would lose everything they typed.
 * Here it's submitted via onSubmit in a transition and the fields stay filled.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
  ref?: Ref<HTMLFormElement>;
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
