"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useTransition,
  type FormHTMLAttributes,
  type Ref,
} from "react";
import type { ActionState } from "@/lib/actions";

const Pending = createContext(false);

/** Is the nearest <ActionForm> submitting? (for SubmitButton) */
export const useActionPending = () => useContext(Pending);

const IDLE: ActionState = { ok: false };

/**
 * `useActionState` for a form Server Action (`formAction` in lib/actions):
 * `[state, action, pending]`, starting from "nothing submitted yet". Pass
 * `action` to <ActionForm>, show `state` with <ActionStatus> / field errors.
 */
export function useServerAction(
  serverAction: (prev: ActionState, formData: FormData) => Promise<ActionState>,
) {
  return useActionState<ActionState, FormData>(serverAction, IDLE);
}

/**
 * `useServerAction` for a form that adds records one after another: after a
 * success it empties itself for the next one when `clearOnSuccess` (an edit
 * form keeps its values). `[state, action, formRef]` — pass `formRef` as the
 * <ActionForm>'s `ref`.
 */
export function useAddForm(
  serverAction: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  clearOnSuccess: boolean,
) {
  const [state, action] = useServerAction(serverAction);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && clearOnSuccess) form.current?.reset();
  }, [state, clearOnSuccess]);
  return [state, action, form] as const;
}

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
