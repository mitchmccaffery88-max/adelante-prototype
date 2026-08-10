/**
 * Front-door Phase 2 — missed pre-release hand-off.
 *
 * Pure logic only (no React, no store access) so the matching rules and the
 * gating conditions are unit-testable. The store side lives in `ehr.ts`
 * (`runSafetyNetRecordLookup`, `generateMissedHandoffCatchUp`).
 */

import type { TriState } from "./frontDoor";

/**
 * The lookup runs for two populations:
 *  1. Phase 1's "not sure" answer to the existing-care-plan question, which
 *     sets `frontDoor.recordLookupPending`;
 *  2. anyone who answers yes / not sure to justice-involvement history during
 *     intake and has no existing plan already found.
 */
export function shouldRunSafetyNetLookup(input: {
  recordLookupPending?: boolean;
  justiceInvolvement?: TriState;
  /** True once a plan/record for this person is already known. */
  existingPlanFound?: boolean;
}): boolean {
  if (input.existingPlanFound) return false;
  if (input.recordLookupPending) return true;
  return input.justiceInvolvement === "yes" || input.justiceInvolvement === "unsure";
}

/** Identity material realistically available in this data model. */
export interface LookupSubject {
  id: string;
  dob?: string;
  /** CIN / Medi-Cal member id — the closest stand-in for a stable identifier. */
  cin?: string;
  phone?: string;
  lastName?: string;
}

export type MatchBasis = "dob_cin" | "dob_phone4_name";

export interface LookupResult {
  status: "match" | "ambiguous" | "none";
  /** Set only when `status === "match"`. */
  matchPatientId?: string;
  basis?: MatchBasis;
  /** Every candidate considered a hit, for the ambiguous case. */
  candidateIds: string[];
}

const norm = (v?: string) => (v ?? "").trim().toLowerCase();
const last4 = (v?: string) => (v ?? "").replace(/\D/g, "").slice(-4);

/**
 * Deterministic pair matching. There is no SSN in this model, so the stable
 * identifier pair is DOB + CIN; when no CIN is on file we fall back to
 * DOB + last-4 of phone + last name. Nothing fuzzy — a near-miss is a
 * non-match, and more than one hit is `ambiguous` (a person decides).
 */
export function matchExistingRecord(
  subject: LookupSubject,
  candidates: LookupSubject[],
): LookupResult {
  if (!norm(subject.dob)) return { status: "none", candidateIds: [] };

  const pool = candidates.filter((c) => c.id !== subject.id && norm(c.dob) === norm(subject.dob));

  const byCin = norm(subject.cin)
    ? pool.filter((c) => norm(c.cin) === norm(subject.cin))
    : [];
  if (byCin.length === 1)
    return {
      status: "match",
      matchPatientId: byCin[0]!.id,
      basis: "dob_cin",
      candidateIds: byCin.map((c) => c.id),
    };
  if (byCin.length > 1) return { status: "ambiguous", candidateIds: byCin.map((c) => c.id) };

  const p4 = last4(subject.phone);
  const byPhone = p4.length === 4
    ? pool.filter((c) => last4(c.phone) === p4 && norm(c.lastName) === norm(subject.lastName))
    : [];
  if (byPhone.length === 1)
    return {
      status: "match",
      matchPatientId: byPhone[0]!.id,
      basis: "dob_phone4_name",
      candidateIds: byPhone.map((c) => c.id),
    };
  if (byPhone.length > 1) return { status: "ambiguous", candidateIds: byPhone.map((c) => c.id) };

  return { status: "none", candidateIds: [] };
}

export const MISSED_HANDOFF_LABEL = "Missed pre-release coordination";

/**
 * DECISION (made, not assumed): the lookup is DISCLOSED, not silent. This copy
 * is shown to the person while it runs. Rationale in the route comment.
 */
export const LOOKUP_DISCLOSURE =
  "We're checking whether a plan was already started for you — including before a release. This doesn't slow anything down, and nothing you've entered is shared outside your care team.";

/**
 * §3 — Medi-Cal reactivation for this population is NOT automatic. The passive
 * "reactivates automatically on release" wording used elsewhere is wrong here:
 * a missed hand-off means nobody worked the enrollment before release, so the
 * record commonly stays suspended or terminated until someone troubleshoots it.
 */
export const MEDI_CAL_FOLLOW_UP_MESSAGE =
  "Because coordination was missed before your release, we won't assume your Medi-Cal turned back on by itself. A staff member will check your status directly and fix it with the county if it's suspended or closed.";

export const MEDI_CAL_FOLLOW_UP_TASK_TITLE =
  "Catch-up — Medi-Cal reactivation check (do not assume automatic)";
