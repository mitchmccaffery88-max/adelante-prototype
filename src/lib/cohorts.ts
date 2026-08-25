// §Engagement/Reporting Build 1 — REAL COHORT RESOLVER.
//
// Population track stays DERIVED. There is still no `Patient.populationTrack`
// field and this module does not create one: a stored track drifts the moment
// an episode closes or a front-door answer is corrected. What was missing was
// not storage, it was a batch read — every caller so far resolved one patient
// at a time, which made a cohort breakdown impossible to compute honestly.
//
// So this is a real batch resolver over the live record: one pass, every
// patient, carrying `provisional` forward from `resolvePopulationTrack` so an
// unconfirmed ("not sure") case is counted in its own bucket and never rolled
// into a confirmed count.
import { AdelanteEHR } from "@/lib/ehr";
import {
  POPULATION_LABEL,
  populationFactsFor,
  resolvePopulationTrack,
  type PopulationTrack,
} from "@/lib/population";

/** Tracks a patient can actually land in. `advocate` is not a population. */
export const PATIENT_TRACKS: PopulationTrack[] = [
  "pre_release_ji",
  "post_release_ji",
  "general_population",
];

export interface CohortMember {
  patientId: string;
  patientName: string;
  track: PopulationTrack;
  /** Why the track resolved that way — straight from the population logic. */
  basis: string;
  /** True when justice involvement is unconfirmed ("not sure"). */
  provisional: boolean;
}

export interface CohortBucket {
  track: PopulationTrack;
  label: string;
  patientIds: string[];
  /** Total members, confirmed + provisional. */
  count: number;
  /** Members whose track is only provisional — reported separately, never merged. */
  provisionalCount: number;
  /** count − provisionalCount. The number safe to describe as established. */
  confirmedCount: number;
}

export interface CohortBreakdown {
  members: CohortMember[];
  buckets: CohortBucket[];
  total: number;
  /** Provisional members across every track. */
  provisionalTotal: number;
  byPatient: Record<string, CohortMember>;
}

/**
 * PURE-ish batch resolve. Reads the live store once (patients + their
 * population facts) and returns the complete breakdown. Callers pass
 * `patientIds` to narrow to a caseload; omit it for the whole program.
 */
export function resolveCohorts(patientIds?: string[]): CohortBreakdown {
  const want = patientIds ? new Set(patientIds) : undefined;
  const patients = AdelanteEHR.listPatients().filter((p) => !want || want.has(p.id));

  const members: CohortMember[] = [];
  for (const p of patients) {
    const facts = populationFactsFor(p.id);
    // A patient with no readable facts is not silently dropped from the
    // denominator: they resolve to the track with no population-specific
    // promises, flagged provisional, exactly like `resolvePopulation` does.
    const res = facts
      ? resolvePopulationTrack(facts)
      : { track: "general_population" as const, basis: "no patient record", provisional: true };
    members.push({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      track: res.track,
      basis: res.basis,
      provisional: res.provisional,
    });
  }

  const buckets: CohortBucket[] = PATIENT_TRACKS.map((track) => {
    const inTrack = members.filter((m) => m.track === track);
    const provisionalCount = inTrack.filter((m) => m.provisional).length;
    return {
      track,
      label: POPULATION_LABEL[track],
      patientIds: inTrack.map((m) => m.patientId),
      count: inTrack.length,
      provisionalCount,
      confirmedCount: inTrack.length - provisionalCount,
    };
  });

  return {
    members,
    buckets,
    total: members.length,
    provisionalTotal: members.filter((m) => m.provisional).length,
    byPatient: Object.fromEntries(members.map((m) => [m.patientId, m])),
  };
}

/** Just the ids in one track — the join key for any per-cohort projection. */
export function cohortPatientIds(track: PopulationTrack, patientIds?: string[]): string[] {
  return resolveCohorts(patientIds).buckets.find((b) => b.track === track)?.patientIds ?? [];
}
