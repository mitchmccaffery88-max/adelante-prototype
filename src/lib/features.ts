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
  | "cures_placeholder"
  | "eligibility_simulated"
  | "erx_simulated"
  | "telehealth_simulated"
  | "caloms_export_simulated"
  | "notifications_simulated"
  | "payments_simulated"
  | "scribe_simulated";

export interface FeatureFlag {
  id: FeatureId;
  description: string;
  owner: string;
  default: boolean;
  scope: FeatureScope;
  /**
   * Standing rule (AGENTS.md): a placeholder / mock / demo integration. Until the
   * persistent backend, security controls and BAA-covered vendors exist, every
   * action tied to it is labelled "Simulated" on screen and audited with
   * `simulated: true` — never a plain "succeeded".
   */
  simulated: boolean;
}

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  {
    id: "in_facility",
    description: "In-facility / inpatient surfaces (medication rounds, shift count, pre-release, custody). Adelante is outpatient-only.",
    owner: "Clinical operations",
    default: false,
    scope: "global",
    simulated: false,
  },
  {
    id: "hie_simulated",
    description: "Simulated health information exchange feed (mock adapter, nothing is sent or received).",
    owner: "Data exchange",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "voice_intake",
    description: "Read aloud / answer by voice for patients; sensitive steps stay tap-only.",
    owner: "Patient experience",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "adel_drafts",
    description: "\"Draft with Adel\" rule-based drafts; a person reviews, edits and saves.",
    owner: "Clinical informatics",
    default: true,
    scope: "role",
    simulated: true,
  },
  {
    id: "placeholder_lab",
    description: "Lab orders are recorded but not sent to a lab (no interface connected).",
    owner: "Clinical informatics",
    default: true,
    scope: "program",
    simulated: true,
  },
  {
    id: "cures_placeholder",
    description: "CURES check is a recorded attestation step; no live CURES connection.",
    owner: "Pharmacy & prescribing",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "eligibility_simulated",
    description: "Medi-Cal / payer eligibility checks run against a mock adapter; no live 270/271.",
    owner: "Revenue cycle",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "erx_simulated",
    description: "eRx / pharmacy send (eScribe mock); prescriptions are recorded, not transmitted.",
    owner: "Pharmacy & prescribing",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "telehealth_simulated",
    description: "Telehealth video vendor is a mock; join links are placeholders.",
    owner: "Clinical operations",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "caloms_export_simulated",
    description: "CalOMS / ISL exports are files only; nothing is submitted to the state.",
    owner: "Compliance & reporting",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "notifications_simulated",
    description: "SMS / email / notification delivery; no BAA-covered sender is connected.",
    owner: "Patient experience",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "payments_simulated",
    description: "Payments and clearinghouse submission are recorded locally; no processor or clearinghouse.",
    owner: "Revenue cycle",
    default: true,
    scope: "global",
    simulated: true,
  },
  {
    id: "scribe_simulated",
    description: "AI scribe vendor is a mock: scripted transcript and draft; no microphone, speech-to-text or AI model. No audio is stored.",
    owner: "Clinical informatics",
    default: true,
    scope: "role",
    simulated: true,
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
  flagChanges.length = 0;
}

/** Shown wherever a simulated flag would be made live. */
export const REQUIRES_LIVE_VENDOR = "Requires authorized vendor + backend";
export interface FlagChange { id: FeatureId; on: boolean; reason: string; by?: string; at: string }
const flagChanges: FlagChange[] = [];
/** Recent admin flag changes (newest first). */
export function listFlagChanges(): FlagChange[] {
  return flagChanges.slice();
}
/**
 * §Turn 6 — admin toggle (runs only through runAction "feature_flag_set").
 * Reason required. `mode: "live"` on a simulated flag is always refused: it
 * needs a BAA-covered vendor and the persistent backend.
 */
export function setFeatureFlagWithReason(id: FeatureId, mode: "on" | "off" | "live", reason: string, by?: string): FlagChange {
  const f = featureFlag(id);
  if (mode === "live") {
    if (f.simulated) throw new Error(`${REQUIRES_LIVE_VENDOR}.`);
    mode = "on";
  }
  if (!reason.trim()) throw new Error("A reason is required to change a feature flag.");
  const on = mode === "on";
  overrides.set(id, on);
  const row = { id, on, reason: reason.trim(), by, at: new Date().toISOString() };
  flagChanges.unshift(row);
  return row;
}
export function featureSnapshot(): { id: FeatureId; value: boolean; flag: FeatureFlag }[] {
  return FEATURE_FLAGS.map((flag) => ({ id: flag.id, value: isFeatureEnabled(flag.id), flag }));
}

/** Flags marked simulated (placeholder integrations). */
export function simulatedFeatureIds(): FeatureId[] {
  return FEATURE_FLAGS.filter((f) => f.simulated).map((f) => f.id);
}
/** On-screen label every simulated confirmation must carry. */
export const SIMULATED_LABEL = "Simulated";

/**
 * Every file under src/lib/vendors/ (except index.ts) → its feature flag.
 * Guard test: a new vendor file without an entry here fails the suite.
 */
export const VENDOR_FLAGS: Readonly<Record<string, FeatureId>> = {
  erx: "erx_simulated",
  hie: "hie_simulated",
  telehealth: "telehealth_simulated",
  scribe: "scribe_simulated",
};

/**
 * On-screen label for simulated integrations that have no registry action of
 * their own (so `confirmationFor` can't label them). Must contain "Simulated".
 */
export const SIMULATED_SURFACE_LABELS: Partial<Record<FeatureId, string>> = {
  voice_intake: `${SIMULATED_LABEL} speech recognition — no audio is stored`,
  adel_drafts: `${SIMULATED_LABEL} — rule-based draft, not AI`,
  telehealth_simulated: `${SIMULATED_LABEL} video vendor`,
  scribe_simulated: `${SIMULATED_LABEL} AI scribe — scripted transcript and draft, no audio stored`,
};
export function simulatedSurfaceLabel(id: FeatureId): string {
  return SIMULATED_SURFACE_LABELS[id] ?? SIMULATED_LABEL;
}
