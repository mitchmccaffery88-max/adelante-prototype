// §Data exchange — HIE operations hub store (matching queue, outbound sharing
// log, demo seed). Built on hie.ts; every action is audited. Unmatched records
// live only here and never reach a chart until "Confirm match".
import { disclose } from "./part2Disclosure";
import { AdelanteEHR } from "./ehr";
import type { StaffRole } from "./roles";
import { DATA_EXCHANGE_ROLES } from "./dataExchangeRoles";
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
import { scoreIdentity, type MatchBand, type MatchField } from "./patientMatching";

const DAY = 86400000;
const HOUR = 3600000;
type Actor = { name: string; role: StaffRole | string };

export interface MatchCandidate {
  id: string;
  incoming: { name: string; dob: string; cin: string; address: string };
  suggestedPatientId: string;
  /** Derived from the one matching engine (patientMatching.scoreIdentity). */
  confidence: "High" | "Low";
  band: MatchBand;
  fields: MatchField[];
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
  /** §Batch C1 — Part 2 redisclosure notice attached to the share message. */
  notice?: string;
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

/** Score an incoming HIE identity against the suggested chart — same engine as every creation path. */
export function scoreHieIncoming(incoming: MatchCandidate["incoming"], patientId: string): { band: MatchBand; fields: MatchField[]; confidence: "High" | "Low" } {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return { band: "none", fields: [], confidence: "Low" };
  const parts = incoming.name.replace(/\./g, "").trim().split(/\s+/);
  const clean = (v: string) => (v === "—" || v === "Unknown" ? undefined : v);
  const r = scoreIdentity(
    { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" "), dob: clean(incoming.dob), cin: clean(incoming.cin), address: clean(incoming.address) },
    { firstName: p.firstName, lastName: p.lastName, dob: p.dob, cin: p.cin, phone: p.phone, email: p.email, address: p.address },
  );
  return { band: r.band, fields: r.fields, confidence: r.band === "exact" || r.band === "probable" ? "High" : "Low" };
}

export function seedDataExchangeDemo(now = new Date()) {
  if (seeded) return;
  seeded = true;
  const sys = { name: "system", role: "sys_admin" };
  _appendHieSyncRun({ at: new Date(now.getTime() - 2 * DAY).toISOString(), received: 3, matched: 2, held: 0, errors: 1, note: "1 message rejected — malformed date" });
  const luis = byFirst("Luis");
  if (luis) {
    const incoming = { name: "Luis Camacho", dob: shiftDob(luis.dob), cin: luis.cin ?? "—", address: luis.address ?? "—" };
    queue.push({
      id: "match-luis",
      incoming,
      suggestedPatientId: luis.id,
      ...scoreHieIncoming(incoming, luis.id),
      record: { kind: "ed_visit", at: new Date(now.getTime() - 3 * DAY).toISOString(), facility: "Valley Regional Medical Center (placeholder)", reason: "Anxiety, released same day" },
      status: "pending",
    });
  }
  const daniel = byFirst("Daniel");
  if (daniel) {
    const incoming = { name: "D. Martinez", dob: daniel.dob, cin: "—", address: "Unknown" };
    queue.push({
      id: "match-dmartinez",
      incoming,
      suggestedPatientId: daniel.id,
      ...scoreHieIncoming(incoming, daniel.id),
      record: { kind: "ed_visit", at: new Date(now.getTime() - 6 * DAY).toISOString(), facility: "Kings General Hospital (placeholder)", reason: "Ankle sprain" },
      status: "pending",
    });
  }
  // Held Part 2 record for a patient WITHOUT sud_treatment consent.
  const jordan = byFirst("Jordan");
  if (jordan)
    _ingestHieEncounter({ id: "hie-jordan-sud-1", patientId: jordan.id, kind: "sud_program", at: new Date(now.getTime() - 4 * DAY).toISOString(), facility: "Outside SUD program (placeholder)", reason: "Outpatient program visit", sud: true }, sys, now);
  // An older ED visit with no follow-up, so "overdue" is visible.
  const rosa = byFirst("Rosa");
  if (rosa) {
    _ingestHieEncounter({ id: "hie-rosa-ed-1", patientId: rosa.id, kind: "ed_visit", at: new Date(now.getTime() - 4 * DAY).toISOString(), facility: "Valley Regional Medical Center (placeholder)", reason: "Fall at home, x-ray negative", sud: false }, sys, now);
    shareToHie({ patientId: rosa.id, at: new Date(now.getTime() - 7 * DAY).toISOString(), recipient: "Dr. A. Lin, outside PCP (placeholder)", what: "Summary of care", purpose: "Treatment / care coordination", consentUsed: "Rosa's treatment-sharing consent on file", actor: sys });
  }
  if (luis)
    shareToHie({ patientId: luis.id, at: new Date(now.getTime() - 10 * DAY).toISOString(), recipient: "Tulare County Housing Navigation (placeholder)", what: "Referral summary (no SUD content)", purpose: "Housing referral", consentUsed: "Luis's release of information on file", actor: sys });
}

/** Simulated feed: one incoming outside record waiting for a staff match decision. Nothing changes until confirmMatch. */
export function queueHieMatch(input: { id: string; patientId: string; record: MatchCandidate["record"] }) {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Unknown patient.");
  const incoming = { name: `${p.firstName} ${p.lastName}`, dob: p.dob, cin: p.cin ?? "—", address: p.address ?? "—" };
  queue.push({ id: input.id, incoming, suggestedPatientId: p.id, ...scoreHieIncoming(incoming, p.id), record: input.record, status: "pending" });
  AdelanteEHR._emit();
}

export function listMatchQueue() {
  return queue.filter((q) => q.status === "pending");
}

export function confirmMatch(id: string, actor: Actor) {
  if (!DATA_EXCHANGE_ROLES.has(actor.role as StaffRole)) throw new Error("Only a clinical coordinator or system admin can decide outside-record matches.");
  const q = queue.find((x) => x.id === id && x.status === "pending");
  if (!q) throw new Error("Already decided.");
  q.status = "matched";
  q.decidedBy = actor.name;
  hieAudit("hie_match_confirmed", q.suggestedPatientId, actor, { candidateId: id, confidence: q.confidence, band: q.band });
  // §Group 2 P3 — only a staff-confirmed sud_program record sets the SUD indicator;
  // the record itself still goes through the Part 2 hold (sud: true).
  const isSud = q.record.kind === "sud_program";
  if (isSud) {
    const p = AdelanteEHR.getPatient(q.suggestedPatientId);
    if (p) {
      p.needs = { ...p.needs, substanceUse: true };
      p.flagSources = { ...(p.flagSources ?? {}), sud: "outside SUD program record confirmed by staff" };
    }
  }
  return _ingestHieEncounter({ id: `hie-${id}`, patientId: q.suggestedPatientId, ...q.record, sud: isSud }, actor);
}

export function rejectMatch(id: string, reason: string, actor: Actor) {
  if (!DATA_EXCHANGE_ROLES.has(actor.role as StaffRole)) throw new Error("Only a clinical coordinator or system admin can decide outside-record matches.");
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

/**
 * §Batch C1 — Simulated outbound HIE share. SUD content goes through the ONE
 * disclosure function (consent check + notice + log); non-SUD passes through.
 */
export function shareToHie(input: {
  patientId: string;
  recipient: string;
  what: string;
  purpose: string;
  consentUsed?: string;
  actor: Actor;
  includesSud?: boolean;
  emergency?: { reason: string };
  at?: string;
}): { ok: true; share: OutboundShare; notice?: string } | { ok: false; reason: string } {
  const res = disclose({
    patientId: input.patientId,
    actor: { name: input.actor.name, role: input.actor.role },
    recipient: { name: input.recipient, type: "hie" },
    purpose: input.purpose,
    channel: "hie_share",
    recordClasses: input.includesSud ? ["SUD treatment notes", "SUD medications"] : [],
    emergency: input.emergency,
    simulated: true,
    at: input.at,
  });
  if (!res.ok) return res;
  const share: OutboundShare = {
    id: `out-${outbound.length + 1}-${input.patientId}`,
    patientId: input.patientId,
    sentAt: input.at ?? new Date().toISOString(),
    recipient: input.recipient,
    what: input.what,
    purpose: input.purpose,
    consentUsed: input.includesSud ? (res.entry?.consentRef ?? "") : (input.consentUsed ?? "Treatment / care coordination"),
    ...(res.notice ? { notice: res.notice } : {}),
  };
  outbound.push(share);
  hieAudit("hie_outbound_share", input.patientId, input.actor, { shareId: share.id, part2: !!input.includesSud, simulated: true });
  return { ok: true, share, notice: res.notice };
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
