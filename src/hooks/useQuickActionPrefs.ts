import { useEffect, useState } from "react";
import { useHydrated } from "@tanstack/react-router";
import { PREFS_CHANGED, readPersonalActions, writePersonalActions } from "@/lib/quickActionPrefs";

export function useQuickActionPrefs(staffId: string | undefined) {
  const hydrated = useHydrated();
  const [state, setState] = useState<{ staffId: string; ids: string[] | null } | null>(null);
  useEffect(() => {
    if (!hydrated || !staffId) return;
    const sync = () => setState({ staffId, ids: readPersonalActions(staffId) });
    sync();
    window.addEventListener(PREFS_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(PREFS_CHANGED, sync); window.removeEventListener("storage", sync); };
  }, [hydrated, staffId]);
  const save = (ids: string[] | null) => {
    if (!hydrated || !staffId) return;
    writePersonalActions(staffId, ids);
  };
  return { ids: hydrated && state?.staffId === staffId ? state?.ids ?? null : null, ready: hydrated && state?.staffId === staffId, save };
}