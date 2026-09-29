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
import { looksPart2, PART2_HOLD } from "./mergePart2";
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
  /** Screener map entries moved (key → result). */
  screenerKeys: string[];
  /** Items held under the original record's consent (Part 2). */
  part2Held: number;
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
    ...Object.fromEntries(Object.entries(outpatientRows() as unknown as Record<string, Row[]>).map(([k, v]) => [k === "referrals" ? "hlocReferrals" : k, v])),
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
  const rec: MergeRecord = { ...summary, id, at, by: actor.name, reason: input.reason.trim(), status: "active", moved: [], embedded: [], planMoved: false, flaggedClaims: [], screenerKeys: [], part2Held: 0 };
  const hold = (item: Row, field?: string) => {
    if (!looksPart2(item, field)) return;
    (item as Record<string, unknown>)[PART2_HOLD] = { mergeId: id, fromPatientId: o.id };
    rec.part2Held++;
  };
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
      else hold(r, name);
      rec.moved.push({ store: name, row: r });
    }
  }
  for (const [field, list] of embeddedLists(o)) {
    if (!list.length) continue;
    const target = ((s as unknown as Record<string, Row[] | undefined>)[field] ??= []);
    for (const item of list) {
      item[TAG] = id;
      hold(item, field);
      target.push(item);
      rec.embedded.push({ field, item });
    }
    list.length = 0;
  }
  // Latest-result map: move keys the survivor doesn't have (history already moved).
  const sm = (s.screeners ??= {} as Patient["screeners"]) as Record<string, unknown>;
  for (const [k, v] of Object.entries((o.screeners ?? {}) as Record<string, Row | undefined>)) {
    if (!v || sm[k]) continue;
    v[TAG] = id;
    hold(v, k);
    sm[k] = v;
    delete (o.screeners as Record<string, unknown>)[k];
    rec.screenerKeys.push(k);
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
  const release = (x: Row) => delete (x as Record<string, unknown>)[PART2_HOLD];
  for (const { row } of rec.moved) {
    row.patientId = rec.otherId;
    delete row[TAG];
    release(row);
    delete (row as Row).needsReviewAfterMerge;
  }
  for (const { field, item } of rec.embedded) {
    const from = (s as unknown as Record<string, Row[] | undefined>)[field];
    if (from) {
      const i = from.indexOf(item);
      if (i >= 0) from.splice(i, 1);
    }
    delete item[TAG];
    release(item);
    ((o as unknown as Record<string, Row[] | undefined>)[field] ??= []).push(item);
  }
  for (const k of rec.screenerKeys) {
    const sm = s.screeners as Record<string, Row | undefined>;
    const v = sm[k];
    if (!v) continue;
    delete sm[k];
    delete v[TAG];
    release(v);
    ((o.screeners ??= {} as Patient["screeners"]) as Record<string, unknown>)[k] = v;
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
export function reconfirmConsentAfterMerge(consentId: string, actor: MatchActor) {
  const st = stores();
  const row = [...(st.consentRecords ?? []), ...(st.disclosures ?? [])].find((r) => r.id === consentId);
  if (!row?.needsReviewAfterMerge) throw new Error("Nothing to re-confirm.");
  const mergeId = (row.needsReviewAfterMerge as { mergeId: string }).mergeId;
  delete row.needsReviewAfterMerge;
  audit("consent_reconfirmed_after_merge", String(row.patientId), actor, { consentId });
  const pending = [...(st.consentRecords ?? []), ...(st.disclosures ?? [])].some((r) => (r.needsReviewAfterMerge as { mergeId?: string } | undefined)?.mergeId === mergeId);
  if (!pending) releasePart2Holds(mergeId, actor);
}

/** Every item still held from a merge (for the "Consent needs review" banner). */
export function heldItemsFor(mergeId: string): Row[] {
  const rec = M().find((m) => m.id === mergeId);
  if (!rec) return [];
  const s = AdelanteEHR.getPatient(rec.survivorId);
  const scr = s ? Object.values((s.screeners ?? {}) as Record<string, Row | undefined>) : [];
  return [...rec.moved.map((m) => m.row), ...rec.embedded.map((e) => e.item), ...scr].filter((x): x is Row => Boolean(x && (x as Record<string, unknown>)[PART2_HOLD]));
}

/** Re-confirm Part 2 consent on the survivor: releases the merge's holds. Coordinator / sys_admin. */
export function releasePart2Holds(mergeId: string, actor: MatchActor) {
  requireMerger(actor);
  const items = heldItemsFor(mergeId);
  for (const x of items) delete (x as Record<string, unknown>)[PART2_HOLD];
  const rec = M().find((m) => m.id === mergeId);
  if (rec) audit("part2_consent_reconfirmed_after_merge", rec.survivorId, actor, { mergeId, released: items.length });
  AdelanteEHR._emit();
  AdelanteEHR._emit();
}

export function _resetMergesForTests() {
  MERGES = undefined;
}
