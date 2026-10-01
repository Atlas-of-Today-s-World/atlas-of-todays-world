import type { ActionState } from "@/lib/actions";

/** Výsledek odeslání formuláře: chyba (alert) nebo potvrzení (status). */
export function ActionStatus({ state, success }: { state: ActionState; success?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">
        {state.error}
      </p>
    );
  }
  if (state.ok && (state.message || success)) {
    return (
      <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-[13px] text-green-800">
        {state.message ?? success}
      </p>
    );
  }
  return null;
}
