// §Intake/SDOH Redesign Phase 2 — the explicit, auditable mapping between the
// intake Needs checkboxes and the AHC-HRSN domains.
//
// This table exists so Phase 3 reconciliation can never guess. It is keyed on
// the REAL domain keys declared in `AHC_HRSN.domains` (src/lib/screeners.ts) —
// not on their display labels, which are prose and can be reworded — and it
// records honestly where there is no clean equivalent on either side.
import { AHC_HRSN, type ScreenerDomain } from "@/lib/screeners";

/** The four checkbox keys the intake Needs step actually writes today. */
export type IntakeNeedKey = "housing" | "food" | "employment" | "transport";

export const INTAKE_NEED_LABEL: Record<IntakeNeedKey, string> = {
  housing: "Stable housing",
  food: "Food / CalFresh",
  employment: "Employment / job training",
  transport: "Transportation",
};

export interface SdohDomainMapping {
  /** `ScreenerDomain.key` from the AHC-HRSN definition. */
  domainKey: string;
  /** `ScreenerDomain.label` as rendered today — for display only. */
  domainLabel: string;
  /**
   * The intake checkbox that represents the same real need, or `null` when the
   * domain has NO honest intake equivalent. Null is a real answer here: it
   * means intake cannot confirm or contradict this domain, so Phase 3 must
   * leave the HRSN finding standing on its own rather than reconciling it.
   */
  intakeKey: IntakeNeedKey | null;
  /** Why this pairing (or non-pairing) is the honest one. */
  rationale: string;
}

/**
 * Every AHC-HRSN domain, in definition order. Two of the five have no intake
 * equivalent, and `employment` (an intake category) has no HRSN domain — the
 * AHC-HRSN core tool does not screen for employment at all.
 */
export const SDOH_DOMAIN_MAPPINGS: SdohDomainMapping[] = [
  {
    domainKey: "housing",
    domainLabel: "Housing instability & quality",
    intakeKey: "housing",
    rationale:
      "Both ask whether the person has a steady place to live. The HRSN domain additionally covers housing quality (mold, heat, pests); intake's checkbox is the coarser of the two but refers to the same need.",
  },
  {
    domainKey: "food",
    domainLabel: "Food insecurity",
    intakeKey: "food",
    rationale:
      "Direct equivalent — the HRSN food items and the intake 'Food / CalFresh' checkbox describe the same need.",
  },
  {
    domainKey: "transportation",
    domainLabel: "Transportation",
    intakeKey: "transport",
    rationale:
      "Direct equivalent — lack of reliable transportation to appointments or daily living.",
  },
  {
    domainKey: "utilities",
    domainLabel: "Utility needs",
    intakeKey: null,
    rationale:
      "NO intake equivalent. Intake never asks about utility shut-off, so a negative intake form is not evidence against a positive HRSN utilities finding.",
  },
  {
    domainKey: "safety",
    domainLabel: "Interpersonal safety",
    intakeKey: null,
    rationale:
      "NO intake equivalent, and deliberately so: interpersonal safety is a validated HITS-scored domain, not a self-service checkbox. It must never be inferred from, or overwritten by, an intake answer.",
  },
];

/** Intake categories with no AHC-HRSN domain at all. */
export const INTAKE_NEEDS_WITHOUT_DOMAIN: IntakeNeedKey[] = ["employment"];

export function mappingForDomainKey(domainKey: string): SdohDomainMapping | undefined {
  return SDOH_DOMAIN_MAPPINGS.find((m) => m.domainKey === domainKey);
}

export function mappingForIntakeKey(intakeKey: IntakeNeedKey): SdohDomainMapping | undefined {
  return SDOH_DOMAIN_MAPPINGS.find((m) => m.intakeKey === intakeKey);
}

/** The intake checkbox matching an AHC-HRSN domain, or null when there is none. */
export function intakeKeyForDomain(domainKey: string): IntakeNeedKey | null {
  return mappingForDomainKey(domainKey)?.intakeKey ?? null;
}

/**
 * Drift guard used by the tests: every domain declared on the real instrument
 * must appear in this table, and no table row may name a domain that no longer
 * exists. Returns the discrepancies rather than throwing, so a caller can show
 * them honestly.
 */
export function mappingCoverageGaps(domains: ScreenerDomain[] = AHC_HRSN.domains): {
  unmappedDomainKeys: string[];
  staleMappingKeys: string[];
} {
  const declared = new Set(domains.map((d) => d.key));
  const mapped = new Set(SDOH_DOMAIN_MAPPINGS.map((m) => m.domainKey));
  return {
    unmappedDomainKeys: [...declared].filter((k) => !mapped.has(k)),
    staleMappingKeys: [...mapped].filter((k) => !declared.has(k)),
  };
}
