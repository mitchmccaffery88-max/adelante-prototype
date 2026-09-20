// §Intake/SDOH Redesign Phase 3 — deciding, honestly, what intake should ask.
//
// Intake today asks the same four checkboxes of everyone. This module turns the
// data the record ALREADY holds into a real plan for the Needs step:
//
//   • `known`       a need we already have real evidence for and that intake can
//                   honestly ask about — "still applies?" rather than a blank
//                   re-ask. Evidence is either a positive AHC-HRSN domain with a
//                   real Phase 2 intake mapping, or an existing `SdohPlanItem`.
//   • `onFileOnly`  a positive AHC-HRSN domain with NO honest intake equivalent
//                   (utilities, interpersonal safety). Shown so the person and
//                   the intake worker can see it is on file, but deliberately
//                   NOT run through confirm/deny: a checkbox cannot confirm or
//                   contradict a HITS-scored safety finding or a utility
//                   shut-off question intake never asks.
//   • `capture`     intake categories with no prior evidence at all — asked the
//                   normal way. This is every category for a general-population
//                   patient, and always includes `employment`, which the
//                   AHC-HRSN core tool does not screen for.
//
// Pure functions only: no store access, so the same plan is testable without a
// patient record.
import type { SdohItemSource, SdohPlanItem } from "@/lib/ehr";
import type { ScreenerDomainResult } from "@/lib/screeners";
import {
  INTAKE_NEED_LABEL,
  SDOH_DOMAIN_MAPPINGS,
  intakeKeyForDomain,
  mappingForDomainKey,
  type IntakeNeedKey,
} from "@/lib/sdohMapping";

export const INTAKE_NEED_KEYS: IntakeNeedKey[] = [
  "housing",
  "food",
  "employment",
  "transport",
];

/** A need intake can honestly ask the person to confirm. */
export interface KnownNeedRow {
  intakeKey: IntakeNeedKey;
  /** What the item is (or would be) called on the plan. */
  need: string;
  /** Plain-language explanation of where this came from. */
  evidence: string;
  /** Provenance to use when this need is confirmed and no item exists yet. */
  source: SdohItemSource;
  /** Set when a real `SdohPlanItem` already exists for this need. */
  existingItemId?: string;
}

/** A positive HRSN domain intake must not re-ask. */
export interface OnFileOnlyRow {
  domainKey: string;
  domainLabel: string;
  rationale: string;
}

export interface IntakeNeedsPlan {
  known: KnownNeedRow[];
  onFileOnly: OnFileOnlyRow[];
  capture: IntakeNeedKey[];
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Does an existing plan item describe this intake category? Matched against
 * both names the same need can carry: the intake label we write ("Stable
 * housing") and the HRSN domain label a pre-release row carries ("Housing
 * instability & quality").
 */
export function itemMatchesIntakeKey(item: SdohPlanItem, key: IntakeNeedKey): boolean {
  const names = [INTAKE_NEED_LABEL[key]];
  for (const m of SDOH_DOMAIN_MAPPINGS) if (m.intakeKey === key) names.push(m.domainLabel);
  return names.some((n) => norm(n) === norm(item.need));
}

/** An item is still live unless it has been worked to a terminal status. */
function isOpen(item: SdohPlanItem): boolean {
  return item.status !== "completed" && item.status !== "not_completed";
}

export function buildIntakeNeedsPlan(input: {
  /** `patient.screeners["ahc-hrsn"].domains` — scored domain results. */
  domains?: ScreenerDomainResult[];
  /** `patient.sdohPlan?.items`. */
  items?: SdohPlanItem[];
}): IntakeNeedsPlan {
  const domains = input.domains ?? [];
  const items = (input.items ?? []).filter(isOpen);

  const known: KnownNeedRow[] = [];
  const onFileOnly: OnFileOnlyRow[] = [];
  const claimed = new Set<IntakeNeedKey>();

  // 1. Positive HRSN domains.
  for (const d of domains) {
    if (!d.positive) continue;
    const intakeKey = intakeKeyForDomain(d.key);
    if (!intakeKey) {
      const m = mappingForDomainKey(d.key);
      onFileOnly.push({
        domainKey: d.key,
        domainLabel: d.label,
        rationale: m?.rationale ?? "No intake equivalent.",
      });
      continue;
    }
    if (claimed.has(intakeKey)) continue;
    const existing = items.find((i) => itemMatchesIntakeKey(i, intakeKey));
    known.push({
      intakeKey,
      need: existing?.need ?? INTAKE_NEED_LABEL[intakeKey],
      evidence: `Identified by your pre-release screening (${d.label}).`,
      // Provenance preservation: an item that already exists keeps the source
      // it was created with. Only a brand-new row gets `pre_release_hrsn`.
      source: existing?.source ?? "pre_release_hrsn",
      ...(existing ? { existingItemId: existing.id } : {}),
    });
    claimed.add(intakeKey);
  }

  // 2. Existing plan items with no HRSN domain behind them (staff-identified,
  //    advocate-raised, or captured at an earlier intake).
  for (const key of INTAKE_NEED_KEYS) {
    if (claimed.has(key)) continue;
    const existing = items.find((i) => itemMatchesIntakeKey(i, key));
    if (!existing) continue;
    known.push({
      intakeKey: key,
      need: existing.need,
      evidence:
        existing.source === "advocate_reported"
          ? "Raised by your advocate."
          : existing.source === "intake_self_report"
            ? "You told us about this at an earlier intake."
            : "Identified by your care team.",
      source: existing.source,
      existingItemId: existing.id,
    });
    claimed.add(key);
  }

  const capture = INTAKE_NEED_KEYS.filter((k) => !claimed.has(k));
  return { known, onFileOnly, capture };
}

/** True when there is any prior evidence to reconcile against. */
export function hasPriorSdohEvidence(plan: IntakeNeedsPlan): boolean {
  return plan.known.length > 0 || plan.onFileOnly.length > 0;
}
