// §Batch E — patient merge / unmerge. Coordinator and sys_admin only, reason
// required, always run through runAction ("patient_merge" / "patient_unmerge").
// Moved rows keep their original authors, dates and ids; each is tagged with
// the merge id so an unmerge (30 days, draft) can move it back.
// Consents and Part 2 disclosures are NOT extended: they move flagged
// "Needs review after merge" and stop authorising anything until re-confirmed.
import { AdelanteEHR, type Patient } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";
import { _mergeRows as chartOrderRows } from "./chartOrders";
import { _mergeRows as caseloadRows } from "./caseloadReview";
import { _mergeRows as outpatientRows } from "./outpatientCare";
import { _mergePlanStore } from "./structuredCarePlan";
import { _closeReviewsForMerge, _reopenReviewAfterUnmerge, canReviewMatches, type MatchActor } from "./patientMatching";

export const UNMERGE_WINDOW_DAYS_DRAFT = 30;
const TAG = "_mergedFrom";
type Row = { patientId?: string; [TAG]?: string } & Record<string, unknown>;

export interface MergeSummary {
  survivorId: string;
  otherId: string;
  counts: Record<string, number>;
  consentsNeedingReview: number;
  disclosuresNeedingReview: number;
  duplicateClaims: number;
}
export interface MergeRecord extends MergeSummary {
  id: string;
  at: string;
  by: string;
  reason: string;
  status: "active" | "unmerged";
  unmergedAt?: string;
  /** Rows re-keyed in module stores: [storeName, rowRef]. */
  moved: { store: string; row: Row }[];
  /** Patient-embedded list items moved: [field, item]. */
  embedded: { field: string; item: Row }[];
  planMoved: boolean;
  flaggedClaims: string[];
}

var MERGES: MergeRecord[] | undefined;
function M(): MergeRecord[] {
  if (!MERGES) MERGES = [];
  return MERGES;
}
export function listMerges(): MergeRecord[] {
  return M();
}
export function mergeFor(patientId: string): MergeRecord | undefined {
  return M().find((m) => m.status === "active" && (m.otherId === patientId || m.survivorId === patientId));
}

function stores(): Record<string, Row[]> {
  return {
    ...(AdelanteEHR._mergeStores() as Record<string, Row[]>),
    ...(chartOrderRows() as unknown as Record<string, Row[]>),
    ...(caseloadRows() as unknown as Record<string, Row[]>),
    ...(outpatientRows() as unknown as Record<string, Row[]>),
    claims: AdelanteEHRExt._mergeClaimRows() as unknown as Row[],
  };
}
function embeddedLists(p: Patient): [string, Row[]][] {
  return Object.entries(p).filter(([, v]) => Array.isArray(v) && v.every((x) => x && typeof x === "object")) as [string, Row[]][];
}

function requireMerger(actor: MatchActor) {
  if (!canReviewMatches(actor.role)) throw new Error("Only a clinical coordinator or system admin can merge records.");
}
function audit(action: string, patientId: string, actor: MatchActor, detail: Record<string, unknown>) {
  AdelanteEHR._appendIdentityAudit({ action, patientId, actorId: actor.staffId, actorRole: String(actor.role), detail });
}

/** What a merge would move, shown before confirming. Changes nothing. */
export function previewMerge(survivorId: string, otherId: string): MergeSummary {
  if (survivorId === otherId) throw new Error("Pick two different records.");
  const s = AdelanteEHR.getPatient(survivorId), o = AdelanteEHR.getPatient(otherId);
  if (!s || !o) throw new Error("Record not found.");
  if (o.mergedInto || s.mergedInto) throw new Error("One of these records is already merged.");
  const counts: Record<string, number> = {};
  for (const [name, rows] of Object.entries(stores())) {
    const n = rows.filter((r) => r.patientId === otherId).length;
    if (n) counts[name] = n;
  }
  for (const [field, list] of embeddedLists(o)) if (list.length) counts[field] = (counts[field] ?? 0) + list.length;
  if (_mergePlanStore().has(otherId)) counts.carePlan = 1;
  const st = stores();
  return {
    survivorId,
    otherId,
    counts,
    consentsNeedingReview: (st.consentRecords ?? []).filter((r) => r.patientId === otherId).length,
    disclosuresNeedingReview: (st.disclosures ?? []).filter((r) => r.patientId === otherId).length,
    duplicateClaims: duplicatePairs(survivorId, otherId).length,
  };
}

type ClaimRow = Row & { id: string; serviceDate?: string; serviceCode?: string; duplicateReview?: unknown };
function duplicatePairs(a: string, b: string): [ClaimRow, ClaimRow][] {
  const claims = AdelanteEHRExt._mergeClaimRows() as unknown as ClaimRow[];
  const out: [ClaimRow, ClaimRow][] = [];
  for (const x of claims.filter((c) => c.patientId === a))
    for (const y of claims.filter((c) => c.patientId === b))
      if (x.serviceDate && x.serviceDate === y.serviceDate && x.serviceCode === y.serviceCode) out.push([x, y]);
  return out;
}

export function mergePatients(input: { survivorId: string; otherId: string; reason: string }, actor: MatchActor): MergeRecord {
  requireMerger(actor);
  if (!input.reason?.trim()) throw new Error("A reason is required to merge.");
  const summary = previewMerge(input.survivorId, input.otherId);
  const s = AdelanteEHR.getPatient(input.survivorId)!, o = AdelanteEHR.getPatient(input.otherId)!;
  const id = `merge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const at = new Date().toISOString();
  const rec: MergeRecord = { ...summary, id, at, by: actor.name, reason: input.reason.trim(), status: "active", moved: [], embedded: [], planMoved: false, flaggedClaims: [] };
  // Duplicate claims are flagged before rows move so both sides are known.
  for (const [x, y] of duplicatePairs(s.id, o.id)) {
    x.duplicateReview = { mergeId: id, otherClaimId: y.id, flaggedAt: at };
    y.duplicateReview = { mergeId: id, otherClaimId: x.id, flaggedAt: at };
    rec.flaggedClaims.push(x.id, y.id);
  }
  for (const [name, rows] of Object.entries(stores())) {
    for (const r of rows) {
      if (r.patientId !== o.id) continue;
      r.patientId = s.id;
      r[TAG] = id;
      if (name === "consentRecords" || name === "disclosures")
        (r as Row).needsReviewAfterMerge = { mergeId: id, fromPatientId: o.id };
      rec.moved.push({ store: name, row: r });
    }
  }
  for (const [field, list] of embeddedLists(o)) {
    if (!list.length) continue;
    const target = ((s as unknown as Record<string, Row[] | undefined>)[field] ??= []);
    for (const item of list) {
      item[TAG] = id;
      target.push(item);
      rec.embedded.push({ field, item });
    }
    list.length = 0;
  }
  const plans = _mergePlanStore();
  if (plans.has(o.id) && !plans.has(s.id)) {
    const plan = plans.get(o.id)!;
    plans.delete(o.id);
    plan.patientId = s.id;
    plans.set(s.id, plan);
    rec.planMoved = true;
  }
  o.mergedInto = s.id;
  o.mergedAt = at;
  delete o.possibleDuplicate;
  delete s.possibleDuplicate;
  M().unshift(rec);
  _closeReviewsForMerge(s.id, o.id, id, actor);
  audit("patient_merged", s.id, actor, { mergeId: id, mergedPatientId: o.id, reason: rec.reason, counts: summary.counts, consentsNeedingReview: summary.consentsNeedingReview, duplicateClaims: summary.duplicateClaims });
  AdelanteEHR._emit();
  return rec;
}

export function canUnmerge(rec: MergeRecord, now = new Date()): boolean {
  return rec.status === "active" && now.getTime() - new Date(rec.at).getTime() <= UNMERGE_WINDOW_DAYS_DRAFT * 86400000;
}

export function unmergePatients(input: { mergeId: string; reason: string }, actor: MatchActor): MergeRecord {
  requireMerger(actor);
  if (!input.reason?.trim()) throw new Error("A reason is required to undo a merge.");
  const rec = M().find((m) => m.id === input.mergeId);
  if (!rec) throw new Error("Merge not found.");
  if (!canUnmerge(rec)) throw new Error(`Merges can only be undone within ${UNMERGE_WINDOW_DAYS_DRAFT} days.`);
  const s = AdelanteEHR.getPatient(rec.survivorId)!;
  const o = AdelanteEHR._allPatientsIncludingMerged().find((p) => p.id === rec.otherId)!;
  for (const { row } of rec.moved) {
    row.patientId = rec.otherId;
    delete row[TAG];
    delete (row as Row).needsReviewAfterMerge;
  }
  for (const { field, item } of rec.embedded) {
    const from = (s as unknown as Record<string, Row[] | undefined>)[field];
    if (from) {
      const i = from.indexOf(item);
      if (i >= 0) from.splice(i, 1);
    }
    delete item[TAG];
    ((o as unknown as Record<string, Row[] | undefined>)[field] ??= []).push(item);
  }
  if (rec.planMoved) {
    const plans = _mergePlanStore();
    const plan = plans.get(s.id);
    if (plan) {
      plans.delete(s.id);
      plan.patientId = o.id;
      plans.set(o.id, plan);
    }
  }
  for (const c of AdelanteEHRExt._mergeClaimRows() as unknown as ClaimRow[])
    if ((c.duplicateReview as { mergeId?: string } | undefined)?.mergeId === rec.id) delete c.duplicateReview;
  delete o.mergedInto;
  delete o.mergedAt;
  rec.status = "unmerged";
  rec.unmergedAt = new Date().toISOString();
  _reopenReviewAfterUnmerge(rec.id);
  audit("patient_unmerged", rec.survivorId, actor, { mergeId: rec.id, restoredPatientId: rec.otherId, reason: input.reason.trim() });
  AdelanteEHR._emit();
  return rec;
}

/** Re-confirm a consent/disclosure carried over by a merge. */
export function reconfirmConsentAfterMerge(consentId: string, actor: { staffId: string; name: string; role: string }) {
  const st = stores();
  const row = [...(st.consentRecords ?? []), ...(st.disclosures ?? [])].find((r) => r.id === consentId);
  if (!row?.needsReviewAfterMerge) throw new Error("Nothing to re-confirm.");
  delete row.needsReviewAfterMerge;
  audit("consent_reconfirmed_after_merge", String(row.patientId), actor, { consentId });
  AdelanteEHR._emit();
}

export function _resetMergesForTests() {
  MERGES = undefined;
}
