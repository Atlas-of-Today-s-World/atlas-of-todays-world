/** The Server Action result type, without the server helpers: client forms import it from here. */

/**
 * Server Action result for `useActionState` (ARCHITEKTURA 4.3): a message for
 * the user, Zod field errors and optionally the id of the newly created record.
 */
export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  id?: string;
  /** Preview images the server found for saved links ({ link → image }), for the editor to show. */
  previews?: Record<string, string>;
}
