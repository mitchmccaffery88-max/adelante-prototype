// §Dashboard Standardization Phase 5c — a read-only rollup of the open items
// that ALREADY exist per patient, each pointing at where it is actually worked.
//
// HONESTY: only three real sources exist per patient today — unsigned
// documentation, unresolved social needs, and pending refill requests. There is
// no reschedule-request record and no group-access-request record anywhere in
// the model, so those are deliberately absent rather than faked.
import { AdelanteEHR } from "@/lib/ehr";
import { listUnsignedWork } from "@/lib/unsignedWork";

export type OpenItemKind = "unsigned_work" | "sdoh_need" | "refill_request";

export interface PatientOpenItem {
  kind: OpenItemKind;
  id: string;
  label: string;
  detail?: string;
  /** Record section the item is worked in. */
  section: string;
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
    items.push({
      kind: "sdoh_need",
      id: need.id,
      label: need.need,
      detail: `Social need · ${need.status.replace(/_/g, " ")}`,
      section: "sdoh",
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
