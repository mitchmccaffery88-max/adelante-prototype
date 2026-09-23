// §Dashboard Standardization Phase 5c — a read-only rollup of the open items
// that ALREADY exist per patient, each pointing at where it is actually worked.
//
// HONESTY: only three real sources exist per patient today — unsigned
// documentation, unresolved social needs, and pending refill requests. There is
// no reschedule-request record and no group-access-request record anywhere in
// the model, so those are deliberately absent rather than faked.
//
// §5d-3 adds open resource referrals (a real, existing per-patient record) and
// a draft aging read on both needs and referrals. No new tracker.
import { AdelanteEHR } from "@/lib/ehr";
import { listUnsignedWork } from "@/lib/unsignedWork";
import {
  referralAgingState,
  sdohAgingLabel,
  sdohNeedAging,
  type SdohAgingState,
} from "@/lib/sdohAging";

export type OpenItemKind =
  | "unsigned_work"
  | "sdoh_need"
  | "refill_request"
  | "resource_referral";

export interface PatientOpenItem {
  kind: OpenItemKind;
  id: string;
  label: string;
  detail?: string;
  /** Record section the item is worked in. */
  section: string;
  /** §5d-3 draft aging state, on the item kinds that have one. */
  aging?: SdohAgingState;
  agingLabel?: string;
}

const UNRESOLVED_SDOH = new Set(["identified", "sent", "accepted", "scheduled"]);

export function listPatientOpenItems(patientId: string): PatientOpenItem[] {
  const items: PatientOpenItem[] = [];

  for (const row of listUnsignedWork().filter((r) => r.patient.id === patientId)) {
    items.push({
      kind: "unsigned_work",
      id: row.id,
      label:
        row.kind === "draft_note" ? "Unsigned progress note" : "Visit with no note documented",
      detail: `${row.date.slice(0, 10)} · ${row.ageDays} day${row.ageDays === 1 ? "" : "s"} old`,
      section: "notes",
    });
  }

  const patient = AdelanteEHR.getPatient(patientId);
  for (const need of patient?.sdohPlan?.items ?? []) {
    if (!UNRESOLVED_SDOH.has(need.status)) continue;
    const referrals = AdelanteEHR.referralsForNeed(patientId, need.id);
    const aging = sdohNeedAging(need, referrals.length);
    items.push({
      kind: "sdoh_need",
      id: need.id,
      label: need.need,
      detail: `Social need · ${need.status.replace(/_/g, " ")}`,
      section: "sdoh",
      aging: aging.state,
      agingLabel: sdohAgingLabel(aging),
    });
  }

  for (const r of patient?.resourceReferrals ?? []) {
    const aging = referralAgingState(r);
    if (aging.state === "closed") continue;
    items.push({
      kind: "resource_referral",
      id: r.id,
      // The provider name is intentionally NOT used here: this rollup renders
      // for any staff viewer, and a recovery/support-group organization name
      // discloses SUD treatment status (42 CFR Part 2, §5d-1).
      label: "Open resource referral",
      detail: `Referral · ${r.status.replace(/_/g, " ")}`,
      section: "referrals",
      aging: aging.state,
      agingLabel: sdohAgingLabel(aging),
    });
  }

  for (const r of AdelanteEHR.listRefillRequests({ patientId, status: "pending" })) {
    items.push({
      kind: "refill_request",
      id: r.id,
      label: `Refill request — ${r.medicationName}`,
      detail: `Requested ${r.requestedAt.slice(0, 10)} by ${r.requestedBy}`,
      section: "orders",
    });
  }

  return items;
}
