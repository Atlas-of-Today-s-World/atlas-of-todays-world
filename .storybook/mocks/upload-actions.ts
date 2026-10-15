/**
 * Stand-in for the upload Server Action (src/features/uploads/actions.ts) in
 * Storybook: the real one is server-only (node:crypto, the session), and a
 * story never uploads. The rich text editor's image button reports this.
 */
export async function prepareUpload(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "Uploads are not available in Storybook." };
}
