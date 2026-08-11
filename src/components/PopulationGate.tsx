// §Adelante Journey Phase 2 — the gating PATTERN for population-specific
// patient-facing features. No content lives here; this only decides whether a
// caller's children render.
//
// Usage:
//   <PopulationGate patientId={id} allow={["pre_release_ji"]}>
//     <ReleaseDayChecklist … />
//   </PopulationGate>
//
// Advocates are NOT gated through this into the patient's track — the advocate
// experience is its own surface (`/advocate`), not a variant of the patient
// view. Passing the advocate viewer resolves to the `advocate` track, which no
// patient-population gate lists.
import type { ReactNode } from "react";
import { useEhr } from "@/lib/ehr";
import {
  isPopulationAllowed,
  resolvePopulation,
  type PopulationResolution,
  type PopulationTrack,
  type PopulationViewer,
} from "@/lib/population";

/** Live population resolution for a patient, re-evaluated on store changes. */
export function usePopulation(
  patientId: string | undefined,
  viewer?: PopulationViewer,
): PopulationResolution {
  return useEhr(() => resolvePopulation(patientId, viewer));
}

export function PopulationGate({
  patientId,
  allow,
  viewer,
  requireConfirmed,
  fallback = null,
  children,
}: {
  patientId: string | undefined;
  allow: PopulationTrack[];
  viewer?: PopulationViewer;
  /** Default true — an unconfirmed ("not sure") track does not open the gate. */
  requireConfirmed?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const resolution = usePopulation(patientId, viewer);
  const allowed = isPopulationAllowed(
    resolution,
    allow,
    requireConfirmed === undefined ? {} : { requireConfirmed },
  );
  return <>{allowed ? children : fallback}</>;
}