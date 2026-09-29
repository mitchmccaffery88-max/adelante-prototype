// §Batch D — feature flag registry. One list of every switch the prototype
// has, with an owner and a scope. `inFacilityEnabled()` reads from here, and
// registry actions declare the flags they depend on (shown in the
// Permissions & features page and recorded in every standard action event).
export type FeatureScope = "global" | "role" | "program";
export type FeatureId =
  | "in_facility"
  | "hie_simulated"
  | "voice_intake"
  | "adel_drafts"
  | "placeholder_lab"
  | "cures_placeholder";

export interface FeatureFlag {
  id: FeatureId;
  description: string;
  owner: string;
  default: boolean;
  scope: FeatureScope;
}

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  {
    id: "in_facility",
    description: "In-facility / inpatient surfaces (medication rounds, shift count, pre-release, custody). Adelante is outpatient-only.",
    owner: "Clinical operations",
    default: false,
    scope: "global",
  },
  {
    id: "hie_simulated",
    description: "Simulated health information exchange feed (mock adapter, nothing is sent or received).",
    owner: "Data exchange",
    default: true,
    scope: "global",
  },
  {
    id: "voice_intake",
    description: "Read aloud / answer by voice for patients; sensitive steps stay tap-only.",
    owner: "Patient experience",
    default: true,
    scope: "global",
  },
  {
    id: "adel_drafts",
    description: "\"Draft with Adel\" rule-based drafts; a person reviews, edits and saves.",
    owner: "Clinical informatics",
    default: true,
    scope: "role",
  },
  {
    id: "placeholder_lab",
    description: "Lab orders are recorded but not sent to a lab (no interface connected).",
    owner: "Clinical informatics",
    default: true,
    scope: "program",
  },
  {
    id: "cures_placeholder",
    description: "CURES check is a recorded attestation step; no live CURES connection.",
    owner: "Pharmacy & prescribing",
    default: true,
    scope: "global",
  },
];

const overrides = new Map<FeatureId, boolean>();

export function featureFlag(id: FeatureId): FeatureFlag {
  const f = FEATURE_FLAGS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown feature flag: ${id}`);
  return f;
}
export function isFeatureEnabled(id: FeatureId): boolean {
  return overrides.has(id) ? overrides.get(id)! : featureFlag(id).default;
}
/** Test / future-segment hook. */
export function setFeatureEnabled(id: FeatureId, on: boolean): void {
  featureFlag(id);
  overrides.set(id, on);
}
export function resetFeatureFlags(): void {
  overrides.clear();
}
export function featureSnapshot(): { id: FeatureId; value: boolean; flag: FeatureFlag }[] {
  return FEATURE_FLAGS.map((flag) => ({ id: flag.id, value: isFeatureEnabled(flag.id), flag }));
}
