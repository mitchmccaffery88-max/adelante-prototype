// Unsaved-draft registry for the patient-record drawer.
// Drawer tabs hold local drafts (care-plan note, progress note). Callers that
// can swap the drawer's patient out from under an in-progress edit (e.g. the
// clinician route's patient picker) check this before switching.
import { useEffect } from "react";

const dirtyDrafts = new Set<string>();

export function hasUnsavedDrawerEdits(): boolean {
  return dirtyDrafts.size > 0;
}

/** Confirm before an action that would discard in-progress drawer edits. */
export function confirmDiscardDrawerEdits(
  message = "You have unsaved changes in the patient record. Switch patients and discard them?",
): boolean {
  if (!hasUnsavedDrawerEdits()) return true;
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

export function useDraftDirty(key: string, dirty: boolean) {
  useEffect(() => {
    if (dirty) dirtyDrafts.add(key);
    else dirtyDrafts.delete(key);
    return () => {
      dirtyDrafts.delete(key);
    };
  }, [key, dirty]);
}
