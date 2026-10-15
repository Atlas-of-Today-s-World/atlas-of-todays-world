import type { VisualsActions } from "@/components/admin/VisualsEditor";
import { deleteVisual, moveVisual, saveVisual } from "./actions";

/**
 * The Server Actions the shared VisualsEditor (components/admin) is given by
 * every page that shows it — components don't import feature actions.
 */
export const VISUAL_ACTIONS: VisualsActions = {
  save: saveVisual,
  remove: deleteVisual,
  move: moveVisual,
};
