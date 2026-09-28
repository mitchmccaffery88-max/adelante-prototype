// §Data exchange — HIE operations hub store (matching queue, outbound sharing
// log, demo seed). Built on hie.ts; every action is audited. Unmatched records
// live only here and never reach a chart until "Confirm match".
import { AdelanteEHR } from "./ehr";
import type { StaffRole } from "./roles";
import {
  _appendHieSyncRun,
  _ingestHieEncounter,
  hieAudit,
  hieChartView,
  hieDraftFor,
  listAllHieEncounters,
  type HieEncounter,
} from "./hie";
import type { HieRecordKind } from "./vendors/hie";

const DAY = 86400000;
const HOUR = 3600000;
type Actor = { name: string; role: StaffRole | string };

export interface MatchCandidate {
  id: string;
  incoming: { name: string; dob: string; cin: string; address: string };
  suggestedPatientId: string;
  confidence: "High" | "Low";
  record: { kind: HieRecordKind; at: string; facility: string; reason: string };
  status: "pending" | "matched" | "rejected";
  reason?: string;
  decidedBy?: string;
}

export interface OutboundShare {
  id: string;
  patientId: string;
  sentAt: string;
  recipient: string;
  what: string;
  purpose: string;
  consentUsed: string;
}

const queue: MatchCandidate[] = [];
const outbound: OutboundShare[] = [];
let seeded = false;

const byFirst = (f: string) => AdelanteEHR.listPatients().find((p) => p.firstName === f);
const shiftDob = (dob: string) => {
  const d = new Date(`${dob}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dob;
  return new Date(d.getTime() + DAY).toISOString().slice(0, 10);
};

export function seedDataExchangeDemo(now = new Date()) {
  if (seeded) return;
  seeded = true;
  const sys = { name: "system", role: "sys_admin" };
  _appendHieSyncRun({ at: new Date(now.getTime() - 2 * DAY).toISOString(), received: 3, matched: 2, held: 0, errors: 1, note: "1 message rejected — malformed date" });
  const luis = byFirst("Luis");
  if (luis)
    queue.push({
      id: "match-luis",
      incoming: { name: "Luis Camacho", dob: shiftDob(luis.dob), cin: luis.cin ?? "—", address: luis.address ?? "—" },
      suggestedPatientId: luis.id,
      confidence: "High",
      record: { kind: "ed_visit", at: new Date(now.getTime() - 3 * DAY).toISOString(), facility: "Valley Regional Medical Center (placeholder)", reason: "Anxiety, released same day" },
      status: "pending",
    });
  const daniel = byFirst("Daniel");
  if (daniel)
    queue.push({
      id: "match-dmartinez",
      incoming: { name: "D. Martinez", dob: daniel.dob, cin: "—", address: "Unknown" },
      suggestedPatientId: daniel.id,
      confidence: "Low",
      record: { kind: "ed_visit", at: new Date(now.getTime() - 6 * DAY).toISOString(), facility: "Kings General Hospital (placeholder)", reason: "Ankle sprain" },
      status: "pending",
    });
  // Held Part 2 record for a patient WITHOUT sud_treatment consent.
  const jordan = byFirst("Jordan");
  if (jordan)
    _ingestHieEncounter({ id: "hie-jordan-sud-1", patientId: jordan.id, kind: "sud_program", at: new Date(now.getTime() - 4 * DAY).toISOString(), facility: "Outside SUD program (placeholder)", reason: "Outpatient program visit", sud: true }, sys, now);
  // An older ED visit with no follow-up, so "overdue" is visible.
  const rosa = byFirst("Rosa");
  if (rosa) {
    _ingestHieEncounter({ id: "hie-rosa-ed-1", patientId: rosa.id, kind: "ed_visit", at: new Date(now.getTime() - 4 * DAY).toISOString(), facility: "Valley Regional Medical Center (placeholder)", reason: "Fall at home, x-ray negative", sud: false }, sys, now);
    outbound.push({ id: "out-rosa-1", patientId: rosa.id, sentAt: new Date(now.getTime() - 7 * DAY).toISOString(), recipient: "Dr. A. Lin, outside PCP (placeholder)", what: "Summary of care", purpose: "Treatment / care coordination", consentUsed: "Rosa's treatment-sharing consent on file" });
  }
  if (luis)
    outbound.push({ id: "out-luis-1", patientId: luis.id, sentAt: new Date(now.getTime() - 10 * DAY).toISOString(), recipient: "Tulare County Housing Navigation (placeholder)", what: "Referral summary (no SUD content)", purpose: "Housing referral", consentUsed: "Luis's release of information on file" });
}

export function listMatchQueue() {
  return queue.filter((q) => q.status === "pending");
}

export function confirmMatch(id: string, actor: Actor) {
  const q = queue.find((x) => x.id === id && x.status === "pending");
  if (!q) throw new Error("Already decided.");
  q.status = "matched";
  q.decidedBy = actor.name;
  hieAudit("hie_match_confirmed", q.suggestedPatientId, actor, { candidateId: id, confidence: q.confidence });
  return _ingestHieEncounter({ id: `hie-${id}`, patientId: q.suggestedPatientId, ...q.record, sud: false }, actor);
}

export function rejectMatch(id: string, reason: string, actor: Actor) {
  const q = queue.find((x) => x.id === id && x.status === "pending");
  if (!q) throw new Error("Already decided.");
  if (!reason.trim()) throw new Error("Please give a reason.");
  q.status = "rejected";
  q.reason = reason.trim();
  q.decidedBy = actor.name;
  hieAudit("hie_match_rejected", undefined, actor, { candidateId: id, reason: q.reason });
  AdelanteEHR._emit();
}

export type FollowUp = "followed" | "overdue" | "open" | "n/a";
export function followUpStatus(e: HieEncounter, now = new Date()): FollowUp {
  if (e.kind !== "ed_visit" && e.kind !== "discharge") return "n/a";
  const d = hieDraftFor(e.id);
  const at = new Date(e.at).getTime();
  if (d?.status === "accepted" && d.decidedAt && new Date(d.decidedAt).getTime() - at <= 48 * HOUR) return "followed";
  return now.getTime() - at > 48 * HOUR ? "overdue" : "open";
}

/** Population list, same masking as the chart. */
export function listIncomingEvents(role: StaffRole, now = new Date()) {
  return listAllHieEncounters()
    .filter((e) => hieChartView(e.patientId, role).encounters.includes(e))
    .map((e) => ({ encounter: e, followUp: followUpStatus(e, now) }))
    .sort((a, b) => b.encounter.at.localeCompare(a.encounter.at));
}

export function listOutboundShares() {
  return [...outbound].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function disclosureCsv(patientId: string, actor: Actor): string {
  const rows = outbound.filter((o) => o.patientId === patientId);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["Sent", "Recipient", "What", "Purpose", "Consent used"].join(",")];
  for (const r of rows) lines.push([r.sentAt, r.recipient, r.what, r.purpose, r.consentUsed].map(esc).join(","));
  hieAudit("hie_disclosure_list_exported", patientId, actor, { entries: rows.length });
  return lines.join("\n");
}

export function _resetDataExchangeForTests() {
  queue.length = 0;
  outbound.length = 0;
  seeded = false;
}
