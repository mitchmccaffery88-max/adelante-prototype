// §HIE — simulated outside-records store. Every screen carries HIE_LABEL.
// Ingest (sync), Adel-drafted follow-ups (accept / edit / dismiss), outside
// meds (accept / ignore) all audit. Nothing here changes the patient's own
// record automatically: accepting a draft creates a case task through the
// normal store function; accepting a med records the review decision only.
// Part 2: SUD records need `sud_treatment` consent at receipt, else they are
// HELD (never shown); received ones are hidden from roles failing
// roleSeesAsamSection.
import { AdelanteEHR } from "./ehr";
import type { StaffRole } from "./roles";
import { roleSeesAsamSection } from "./asamReporting";
import { cohortGuard, type CohortGuard } from "./cohortGuard";
import { MockHieAdapter, type HieRecordKind } from "./vendors/hie";

export const HIE_LABEL = "Simulated HIE feed — demo data, no live connection";
export const HIE_SOURCE = "HIE (simulated)";
export const ADEL_DRAFT_LABEL = "Draft by Adel";
const DAY = 86400000;
const HOUR = 3600000;

export const KIND_LABEL: Record<HieRecordKind, string> = {
  ed_visit: "ED visit",
  admission: "Hospital admission",
  discharge: "Hospital discharge",
  sud_program: "Outside program visit",
};

export interface HieEncounter {
  id: string;
  patientId: string;
  kind: HieRecordKind;
  at: string;
  facility: string;
  reason: string;
  dischargeDiagnosis?: string;
  sud: boolean;
  part2Consent: boolean;
  held: boolean;
  receivedAt: string;
}
export interface HieDraft {
  id: string;
  encounterId: string;
  patientId: string;
  text: string;
  status: "draft" | "accepted" | "dismissed";
  decidedBy?: string;
  decidedAt?: string;
  taskId?: string;
  reason?: string;
}
export interface HieMed {
  id: string;
  patientId: string;
  name: string;
  sig: string;
  prescriber: string;
  status: "review" | "accepted" | "ignored";
  decidedBy?: string;
}

type Actor = { name: string; role: StaffRole | string };

const encounters: HieEncounter[] = [];
const drafts: HieDraft[] = [];
const meds: HieMed[] = [];
let lastSyncAt: string | null = null;

export interface HieSyncRun {
  id: string;
  at: string;
  received: number;
  matched: number;
  held: number;
  errors: number;
  note?: string;
}
const syncLog: HieSyncRun[] = [];
export function hieSyncLog(limit = 10): HieSyncRun[] {
  return [...syncLog].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
export function _appendHieSyncRun(run: Omit<HieSyncRun, "id">) {
  syncLog.push({ ...run, id: `sync-${syncLog.length + 1}` });
}
export function listAllHieEncounters(): readonly HieEncounter[] {
  return encounters;
}

export function hieAudit(action: string, patientId: string | undefined, actor: Actor, detail: Record<string, unknown>) {
  audit(action, patientId, actor, detail);
}

function audit(action: string, patientId: string | undefined, actor: Actor, detail: Record<string, unknown>) {
  AdelanteEHR._recordAudit({ category: "hie", action, patientId, actorId: actor.name, actorRole: actor.role, detail: { ...detail, source: HIE_SOURCE } } as never);
}

function draftText(e: HieEncounter): string {
  if (e.kind === "ed_visit")
    return "ED visit yesterday — call within 48 hours, review safety plan, update med list.";
  if (e.kind === "discharge")
    return "Hospital discharge today — call within 48 hours, confirm follow-up visit, update med list.";
  return "Outside hospital admission — check in with the patient and care team.";
}

export function hieStatus() {
  return { name: MockHieAdapter.vendorName, mode: "Simulated" as const, lastSyncAt };
}

/** Pull the simulated feed. Idempotent by feed id; audited. */
export function runSimulatedHieSync(actor: Actor = { name: "system", role: "sys_admin" }, now = new Date()) {
  const feed = MockHieAdapter.fetchFeed(now);
  const find = (first: string) => AdelanteEHR.listPatients().find((p) => p.firstName === first);
  let added = 0;
  let received = 0;
  let heldN = 0;
  for (const r of feed.encounters) {
    received++;
    const p = find(r.patientFirstName);
    if (!p || encounters.some((e) => e.id === r.feedId)) continue;
    const consent = r.sud ? AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment") : true;
    const e: HieEncounter = {
      id: r.feedId, patientId: p.id, kind: r.kind, at: r.at, facility: r.facility, reason: r.reason,
      dischargeDiagnosis: r.dischargeDiagnosis, sud: r.sud, part2Consent: consent, held: r.sud && !consent,
      receivedAt: now.toISOString(),
    };
    encounters.push(e);
    added++;
    if (e.held) heldN++;
    audit(e.held ? "hie_record_held" : "hie_record_received", p.id, actor, { encounterId: e.id, kind: e.sud ? "protected" : e.kind });
    if (!e.sud && (e.kind === "ed_visit" || e.kind === "discharge"))
      drafts.push({ id: `draft-${e.id}`, encounterId: e.id, patientId: p.id, text: draftText(e), status: "draft" });
  }
  for (const m of feed.medications) {
    received++;
    const p = find(m.patientFirstName);
    if (!p || meds.some((x) => x.id === m.feedId)) continue;
    meds.push({ id: m.feedId, patientId: p.id, name: m.name, sig: m.sig, prescriber: m.prescriber, status: "review" });
    added++;
  }
  lastSyncAt = now.toISOString();
  _appendHieSyncRun({ at: lastSyncAt, received, matched: added - heldN, held: heldN, errors: 0 });
  audit("hie_sync", undefined, actor, { added });
  AdelanteEHR._emit();
  return { added, at: lastSyncAt };
}

/** Attach one already-matched outside record to a chart (matching queue / demo seed). */
export function _ingestHieEncounter(
  r: { id: string; patientId: string; kind: HieRecordKind; at: string; facility: string; reason: string; dischargeDiagnosis?: string; sud: boolean },
  actor: Actor,
  now = new Date(),
) {
  if (encounters.some((e) => e.id === r.id)) return encounters.find((e) => e.id === r.id)!;
  const consent = r.sud ? AdelanteEHR.isConsentCategoryAuthorized(r.patientId, "sud_treatment") : true;
  const e: HieEncounter = { ...r, part2Consent: consent, held: r.sud && !consent, receivedAt: now.toISOString() };
  encounters.push(e);
  audit(e.held ? "hie_record_held" : "hie_record_received", r.patientId, actor, { encounterId: e.id, kind: e.sud ? "protected" : e.kind });
  if (!e.sud && (e.kind === "ed_visit" || e.kind === "discharge"))
    drafts.push({ id: `draft-${e.id}`, encounterId: e.id, patientId: r.patientId, text: draftText(e), status: "draft" });
  AdelanteEHR._emit();
  return e;
}

/** Held Part 2 records, minimal metadata only. */
export function listHeldHieRecords() {
  return encounters
    .filter((e) => e.held)
    .map((e) => ({
      id: e.id,
      patientId: e.patientId,
      at: e.at,
      sourceType: KIND_LABEL[e.kind],
      consentNowOnFile: AdelanteEHR.isConsentCategoryAuthorized(e.patientId, "sud_treatment"),
    }));
}

/** Release a held record once Part 2 consent is on file. Audited. */
export function releaseHeldHieRecord(id: string, actor: Actor) {
  const e = encounters.find((x) => x.id === id);
  if (!e || !e.held) throw new Error("Record is not held.");
  if (!AdelanteEHR.isConsentCategoryAuthorized(e.patientId, "sud_treatment"))
    throw new Error("Part 2 consent is still required.");
  e.held = false;
  e.part2Consent = true;
  audit("hie_record_released", e.patientId, actor, { encounterId: id, kind: "protected" });
  AdelanteEHR._emit();
}

/** What a role may see for one patient. Held records only as a count, and only to Part 2-permitted roles. */
export function hieChartView(patientId: string, role: StaffRole) {
  const patient = AdelanteEHR.getPatient(patientId);
  const sees = roleSeesAsamSection(role, patient);
  const mine = encounters.filter((e) => e.patientId === patientId);
  return {
    encounters: mine.filter((e) => !e.held && (!e.sud || sees)).sort((a, b) => b.at.localeCompare(a.at)),
    heldCount: sees ? mine.filter((e) => e.held).length : 0,
    hiddenForRole: !sees && mine.some((e) => e.sud && !e.held),
  };
}

export function hieDraftFor(encounterId: string) {
  return drafts.find((d) => d.encounterId === encounterId);
}

function draftOrThrow(id: string) {
  const d = drafts.find((x) => x.id === id);
  if (!d) throw new Error("Draft not found.");
  if (d.status !== "draft") throw new Error("This draft was already decided.");
  return d;
}

export function editHieDraft(id: string, text: string, actor: Actor) {
  const d = draftOrThrow(id);
  if (!text.trim()) throw new Error("Task text can't be empty.");
  d.text = text.trim();
  audit("hie_draft_edited", d.patientId, actor, { draftId: id });
  AdelanteEHR._emit();
}

export function acceptHieDraft(id: string, actor: Actor, text?: string, now = new Date()) {
  const d = draftOrThrow(id);
  if (text && text.trim() && text.trim() !== d.text) d.text = text.trim();
  const task = AdelanteEHR.createCaseTask({
    patientId: d.patientId,
    assignedTo: actor.name,
    title: d.text,
    detail: `From ${HIE_SOURCE}. ${ADEL_DRAFT_LABEL}, accepted by ${actor.name}.`,
    dueDate: new Date(now.getTime() + 2 * DAY).toISOString().slice(0, 10),
    dedupeKey: `hie:${d.encounterId}`,
    priority: "urgent",
    source: "hie",
  });
  d.status = "accepted";
  d.decidedBy = actor.name;
  d.decidedAt = now.toISOString();
  d.taskId = task?.id;
  audit("hie_draft_accepted", d.patientId, actor, { draftId: id, taskId: task?.id });
  AdelanteEHR._emit();
  return task;
}

export function dismissHieDraft(id: string, reason: string, actor: Actor, now = new Date()) {
  const d = draftOrThrow(id);
  if (!reason.trim()) throw new Error("Please give a reason for dismissing.");
  d.status = "dismissed";
  d.reason = reason.trim();
  d.decidedBy = actor.name;
  d.decidedAt = now.toISOString();
  audit("hie_draft_dismissed", d.patientId, actor, { draftId: id, reason: d.reason });
  AdelanteEHR._emit();
}

export function listHieMeds(patientId: string) {
  return meds.filter((m) => m.patientId === patientId);
}

export function decideHieMed(id: string, decision: "accepted" | "ignored", actor: Actor) {
  const m = meds.find((x) => x.id === id);
  if (!m) throw new Error("Medication not found.");
  if (m.status !== "review") throw new Error("Already reviewed.");
  m.status = decision;
  m.decidedBy = actor.name;
  audit(decision === "accepted" ? "hie_med_accepted" : "hie_med_ignored", m.patientId, actor, { medId: id, name: m.name });
  AdelanteEHR._emit();
}

/** My work rows: undecided follow-up drafts for these patients, role-filtered. */
export function hieFollowUps(patientIds: string[], role: StaffRole) {
  const set = new Set(patientIds);
  return drafts
    .filter((d) => d.status === "draft" && set.has(d.patientId))
    .map((d) => ({ draft: d, encounter: encounters.find((e) => e.id === d.encounterId)! }))
    .filter(({ encounter }) => encounter && hieChartView(encounter.patientId, role).encounters.includes(encounter));
}

export interface HieUtilization extends CohortGuard {
  edVisits: number;
  admissions: number;
  followUpPct: number | null;
}

/** De-identified population counts, last 30 days. SUD records never counted. */
export function hieUtilization(now = new Date()): HieUtilization {
  const recent = encounters.filter((e) => !e.sud && now.getTime() - new Date(e.at).getTime() <= 30 * DAY);
  const ed = recent.filter((e) => e.kind === "ed_visit");
  const adm = recent.filter((e) => e.kind === "admission");
  const events = recent.filter((e) => e.kind === "ed_visit" || e.kind === "discharge");
  const followed = events.filter((e) => {
    const d = hieDraftFor(e.id);
    return d?.status === "accepted" && d.decidedAt && new Date(d.decidedAt).getTime() - new Date(e.at).getTime() <= 48 * HOUR;
  });
  return {
    edVisits: ed.length,
    admissions: adm.length,
    followUpPct: events.length ? Math.round((followed.length / events.length) * 100) : null,
    ...cohortGuard(new Set(recent.map((e) => e.patientId)).size),
  };
}

export function _resetHieForTests() {
  encounters.length = 0;
  drafts.length = 0;
  meds.length = 0;
  syncLog.length = 0;
  lastSyncAt = null;
}
