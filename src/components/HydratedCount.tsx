import { useHydrated } from "@tanstack/react-router";

/**
 * §Batch G4 — live counts read the in-memory store and the clock, which differ
 * between the server render and the browser. The server and the first browser
 * render both show a neutral placeholder; the real number appears after mount.
 */
export function HydratedCount({ value, placeholder = "·" }: { value: number | string; placeholder?: string }) {
  const hydrated = useHydrated();
  return <>{hydrated ? value : placeholder}</>;
}
