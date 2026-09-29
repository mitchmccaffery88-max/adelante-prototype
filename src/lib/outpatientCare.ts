// §B3/B4 — outpatient episodes of care and higher-level-of-care referrals.
// Separate from the in-facility pre-release episodes (unchanged). All writes
// audit through AdelanteEHR._recordAudit; notifications are Part 2-safe.
import { AdelanteEHR, type Patient } from "./ehr";
import type { StaffRole } from "./roles";
import { roleSeesAsamSection } from "./asamReporting";

export type EpisodeProgram = "outpatient_mh" | "outpatient_sud" | "ecm";
export const EPISODE_PROGRAM_LABEL: Record<EpisodeProgram, string> = {
  outpatient_mh: "Outpatient mental health",
  outpatient_sud: "Outpatient SUD (DMC-ODS)",
  ecm: "Enhanced Care Management",
};
export type DischargeReason = "completed" | "transferred" | "left_against_advice" | "lost_to_contact" | "higher_level_of_care" | "incarcerated";
export const DISCHARGE_REASON_LABEL: Record<DischargeReason, string> = {
  completed: "Completed treatment",
  transferred: "Transferred",
  left_against_advice: "Left against advice",
  lost_to_contact: "Lost to contact",
  higher_level_of_care: "Higher level of care",
  incarcerated: "Incarcerated",
};
export interface CareEpisode {
  id: string;
  patientId: string;
  program: EpisodeProgram;
  openedAt: string;
  openedBy: string;
  readmitOf?: string;
  closedAt?: string;
  closedBy?: string;
  dischargeReason?: DischargeReason;
  dischargeSummary?: string;
}

export type HlocTarget = "iop" | "residential" | "withdrawal_management" | "inpatient_psych" | "crisis_stabilization";
export const HLOC_TARGET_LABEL: Record<HlocTarget, string> = {
  iop: "Intensive outpatient (IOP)",
  residential: "Residential",
  withdrawal_management: "Withdrawal management",
  inpatient_psych: "Inpatient psychiatric",
  crisis_stabilization: "Crisis stabilization",
};
export type HlocStatus = "drafted" | "sent" | "accepted" | "declined" | "admitted" | "closed";
export const HLOC_NEXT: Record<HlocStatus, HlocStatus[]> = {
  drafted: ["sent"],
  sent: ["accepted", "declined"],
  accepted: ["admitted", "closed"],
  declined: ["closed"],
  admitted: ["closed"],
  closed: [],
};
export interface HlocReferral {
  id: string;
  patientId: string;
  target: HlocTarget;
  reason: string;
  urgency: "routine" | "urgent" | "emergent";
  destination: string;
  /** Destination is an outside SUD provider → Part 2 disclosure consent needed to send. */
  outsideSudProvider: boolean;
  asamId?: string;
  sudRelated: boolean;
  status: HlocStatus;
  createdAt: string;
  createdBy: string;
  history: Array<{ at: string; status: HlocStatus; by: string; note?: string }>;
}

const episodes: CareEpisode[] = [];
const referrals: HlocReferral[] = [];
const uid = () => Math.random().toString(36).slice(2, 10);
const CLINICAL = ["therapist", "pmhnp", "physician", "sud_counselor", "clinical_trainee", "clinical_coordinator", "sys_admin"];
export const EPISODE_ROLES = [...CLINICAL, "ecm_provider"];
/** Roles that may create a higher-level-of-care referral (store-enforced). */
export const HLOC_REFERRAL_ROLES = ["therapist", "pmhnp", "physician", "sud_counselor", "sys_admin"];

type Actor = { name: string; role: StaffRole | string };
function assertRole(actor: Actor, roles: string[], what: string) {
  if (!roles.includes(actor.role)) throw new Error(`Your role can't ${what}.`);
}
function patientOf(id: string): Patient {
  const p = AdelanteEHR.getPatient(id);
  if (!p) throw new Error("Patient not found.");
  return p;
}
const audit = (action: string, patientId: string, actor: Actor, detail: Record<string, unknown>) =>
  AdelanteEHR._recordAudit({ category: "clinical", action, patientId, actorId: actor.name, actorRole: actor.role, detail });
function notifyTeam(patientId: string, subject: string, body: string, category: "episode_changed" | "hloc_referral") {
  const p = AdelanteEHR.getPatient(patientId);
  if (p?.primaryClinicianId)
    AdelanteEHR.notify({ recipientRole: "therapist", category, subject, body, linkRoute: "/record/$patientId", linkParams: { patientId }, patientId });
  AdelanteEHR.notify({ recipientRole: "clinical_coordinator", category, subject, body, linkRoute: "/record/$patientId", linkParams: { patientId }, patientId });
}
function initials(p: Patient) {
  return `${p.firstName?.[0] ?? ""}.${p.lastName?.[0] ?? ""}.`;
}

// ---------- Episodes ----------
export function listEpisodes(patientId: string): CareEpisode[] {
  return episodes.filter((e) => e.patientId === patientId).sort((a, b) => +new Date(b.openedAt) - +new Date(a.openedAt));
}
export function activeEpisode(patientId: string): CareEpisode | undefined {
  return listEpisodes(patientId).find((e) => !e.closedAt);
}
export function openEpisode(input: { patientId: string; program: EpisodeProgram; actor: Actor; readmitOf?: string; at?: string }): CareEpisode {
  assertRole(input.actor, EPISODE_ROLES, "open an episode of care");
  patientOf(input.patientId);
  if (activeEpisode(input.patientId)) throw new Error("This patient already has an open episode. Discharge it first.");
  const e: CareEpisode = { id: uid(), patientId: input.patientId, program: input.program, openedAt: input.at ?? new Date().toISOString(), openedBy: input.actor.name, readmitOf: input.readmitOf };
  episodes.push(e);
  audit(input.readmitOf ? "episode_readmitted" : "episode_opened", input.patientId, input.actor, { episodeId: e.id, program: e.program, readmitOf: e.readmitOf });
  notifyTeam(input.patientId, input.readmitOf ? "Patient readmitted" : "Episode of care opened", "An episode of care was opened in Adelante. Open the chart for details.", "episode_changed");
  return e;
}
/** Discharge preview: what closing the episode will touch (for the confirm step). */
export function dischargeImpact(patientId: string, now = new Date()) {
  const tasks = AdelanteEHR.caseTasksForPatient(patientId).filter((t) => t.status !== "done");
  const visits = AdelanteEHR.appointmentsForPatient(patientId).filter((a) => a.status === "scheduled" && new Date(a.start) > now);
  return { openTasks: tasks.length, futureVisits: visits.length };
}
export function dischargeEpisode(input: {
  patientId: string;
  reason: DischargeReason;
  summary: string;
  actor: Actor;
  confirmCancelVisits: boolean;
  at?: string;
}): { episode: CareEpisode; tasksClosed: number; visitsCancelled: number; visitsLeft: number } {
  assertRole(input.actor, EPISODE_ROLES, "discharge an episode");
  const e = activeEpisode(input.patientId);
  if (!e) throw new Error("There is no open episode to discharge.");
  if (!DISCHARGE_REASON_LABEL[input.reason]) throw new Error("Pick a discharge reason.");
  if ((input.summary ?? "").trim().length < 10) throw new Error("Write a short discharge summary.");
  const at = input.at ?? new Date().toISOString();
  const tasks = AdelanteEHR.caseTasksForPatient(input.patientId).filter((t) => t.status !== "done");
  for (const t of tasks) AdelanteEHR.completeCaseTask(t.id);
  let cancelled = 0;
  let left = 0;
  const visits = AdelanteEHR.appointmentsForPatient(input.patientId).filter((a) => a.status === "scheduled" && new Date(a.start) > new Date(at));
  if (visits.length && !input.confirmCancelVisits) throw new Error("Confirm that future visits will be cancelled.");
  for (const a of visits) {
    try {
      AdelanteEHR.staffCancelAppointment(a.id, { reason: "other", note: "Episode of care discharged", actor: { name: input.actor.name, role: input.actor.role as StaffRole } });
      cancelled++;
    } catch {
      left++;
    }
  }
  e.closedAt = at;
  e.closedBy = input.actor.name;
  e.dischargeReason = input.reason;
  e.dischargeSummary = input.summary.trim();
  audit("episode_discharged", input.patientId, input.actor, {
    episodeId: e.id, reason: input.reason, tasksClosed: tasks.length, taskNote: "Closed at discharge", visitsCancelled: cancelled, visitsLeft: left,
  });
  notifyTeam(input.patientId, "Patient discharged", "An episode of care was closed in Adelante. Open the chart for details.", "episode_changed");
  return { episode: e, tasksClosed: tasks.length, visitsCancelled: cancelled, visitsLeft: left };
}
export function readmit(input: { patientId: string; program?: EpisodeProgram; actor: Actor }): CareEpisode {
  const last = listEpisodes(input.patientId).find((e) => e.closedAt);
  if (!last) throw new Error("There is no closed episode to readmit from.");
  return openEpisode({ patientId: input.patientId, program: input.program ?? last.program, actor: input.actor, readmitOf: last.id });
}
/** Part 2 — SUD episodes and SUD referrals are masked for roles failing the ASAM check. */
export function canSeeSud(role: StaffRole | string, patientId: string): boolean {
  const p = AdelanteEHR.getPatient(patientId);
  return !!p && roleSeesAsamSection(role as StaffRole, p);
}
/** Header wording for this viewer. */
export function episodeHeaderLabel(patientId: string, role: StaffRole | string): string | undefined {
  const e = activeEpisode(patientId);
  if (!e) return listEpisodes(patientId).length ? "Discharged" : undefined;
  if (e.program === "outpatient_sud" && !canSeeSud(role, patientId)) return "Active in Adelante care";
  return `${EPISODE_PROGRAM_LABEL[e.program]}${e.readmitOf ? " · readmitted" : ""}`;
}
export function visibleEpisodes(patientId: string, role: StaffRole | string): CareEpisode[] {
  const sud = canSeeSud(role, patientId);
  return listEpisodes(patientId).filter((e) => sud || e.program !== "outpatient_sud");
}

// ---------- Higher-level-of-care referrals ----------
const SUD_TARGETS: HlocTarget[] = ["residential", "withdrawal_management"];
export function createHlocReferral(input: {
  patientId: string;
  target: HlocTarget;
  reason: string;
  urgency: HlocReferral["urgency"];
  destination: string;
  outsideSudProvider: boolean;
  asamId?: string;
  actor: Actor;
}): HlocReferral {
  assertRole(input.actor, HLOC_REFERRAL_ROLES, "create a clinical referral");
  patientOf(input.patientId);
  if ((input.reason ?? "").trim().length < 3) throw new Error("A reason is required.");
  if (!input.destination.trim()) throw new Error("Pick or type a destination provider.");
  const r: HlocReferral = {
    id: uid(), patientId: input.patientId, target: input.target, reason: input.reason.trim(), urgency: input.urgency,
    destination: input.destination.trim(), outsideSudProvider: input.outsideSudProvider, asamId: input.asamId,
    sudRelated: SUD_TARGETS.includes(input.target) || !!input.asamId || input.outsideSudProvider,
    status: "drafted", createdAt: new Date().toISOString(), createdBy: input.actor.name,
    history: [{ at: new Date().toISOString(), status: "drafted", by: input.actor.name }],
  };
  referrals.push(r);
  audit("hloc_referral_drafted", input.patientId, input.actor, { referralId: r.id, target: r.target, urgency: r.urgency, sudRelated: r.sudRelated });
  return r;
}
/** Why sending is blocked, or undefined. Outside SUD provider needs a legal Part 2 disclosure consent. */
export function hlocSendBlocker(r: HlocReferral): string | undefined {
  if (r.outsideSudProvider && !AdelanteEHR.hasLegalDisclosureConsent(r.patientId))
    return "Sending to an outside SUD provider needs the patient's 42 CFR Part 2 disclosure consent. Record it first.";
  return undefined;
}
export function advanceHlocReferral(id: string, to: HlocStatus, actor: Actor, note?: string): HlocReferral {
  assertRole(actor, ["therapist", "pmhnp", "physician", "sud_counselor", "clinical_coordinator", "sys_admin"], "update a clinical referral");
  const r = referrals.find((x) => x.id === id);
  if (!r) throw new Error("Referral not found.");
  if (!HLOC_NEXT[r.status].includes(to)) throw new Error(`A ${r.status} referral can't move to ${to}.`);
  if (to === "sent") {
    const b = hlocSendBlocker(r);
    if (b) {
      audit("hloc_referral_send_blocked", r.patientId, actor, { referralId: r.id, why: "part2_disclosure_consent_missing" });
      throw new Error(b);
    }
  }
  if (to === "declined" && (note ?? "").trim().length < 3) throw new Error("A reason is required when the referral is declined.");
  r.status = to;
  r.history.push({ at: new Date().toISOString(), status: to, by: actor.name, note: note?.trim() || undefined });
  audit(`hloc_referral_${to}`, r.patientId, actor, { referralId: r.id, target: r.target });
  const p = patientOf(r.patientId);
  notifyTeam(r.patientId, `Clinical referral update — ${initials(p)}`, "A clinical referral changed status. Open the chart for details.", "hloc_referral");
  return r;
}
export function listHlocReferrals(patientId?: string): HlocReferral[] {
  return referrals.filter((r) => !patientId || r.patientId === patientId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
export function visibleHlocReferrals(role: StaffRole | string, patientId?: string): HlocReferral[] {
  return listHlocReferrals(patientId).filter((r) => !r.sudRelated || canSeeSud(role, r.patientId));
}
export function hiddenHlocCount(role: StaffRole | string, patientId?: string): number {
  return listHlocReferrals(patientId).length - visibleHlocReferrals(role, patientId).length;
}

/** A legal Part 2 disclosure captured on a referral — recipient, purpose, date. */
export interface LegalDisclosure {
  id: string; patientId: string; recipient: string; purpose: string; recordedAt: string;
  recordedBy: string; revokedAt?: string; revokedBy?: string; revokeReason?: string;
}
const disclosures: LegalDisclosure[] = [];
export function listLegalDisclosures(patientId: string): LegalDisclosure[] {
  return disclosures.filter((d) => d.patientId === patientId).map((d) => ({ ...d }));
}
/** Revoke: the ledger stays; a new consent record turns the Part 2 disclosure section off. */
export function revokeLegalDisclosure(id: string, actor: Actor & { staffId?: string }, reason: string): void {
  const d = disclosures.find((x) => x.id === id);
  if (!d) throw new Error("Disclosure not found.");
  if (d.revokedAt) throw new Error("Already revoked.");
  if (reason.trim().length < 3) throw new Error("A reason is required to revoke.");
  d.revokedAt = new Date().toISOString(); d.revokedBy = actor.name; d.revokeReason = reason.trim();
  if (!disclosures.some((x) => x.patientId === d.patientId && !x.revokedAt)) {
    const prior = AdelanteEHR.activeConsentRecord(d.patientId);
    const p = patientOf(d.patientId);
    const sections = [...(prior?.sections ?? []).filter((s) => s.category !== "legal_part2_disclosure"), { category: "legal_part2_disclosure" as const, authorized: false }];
    AdelanteEHR.createConsentRecord({
      patientId: d.patientId, formType: prior?.formType ?? "AB133", source: "in person — consent tab", signedByName: `${p.firstName} ${p.lastName}`, attested: true,
      effectiveDate: new Date().toISOString().slice(0, 10), sections, capturedBy: { staffId: actor.staffId, staffName: actor.name, role: actor.role },
    });
  }
  audit("legal_disclosure_revoked", d.patientId, actor, { disclosureId: id, reason: d.revokeReason });
}

/** For the demo: capture a legal Part 2 disclosure section on top of the active consent record. */
export function recordLegalDisclosureConsent(patientId: string, actor: Actor & { staffId?: string }, signedByName: string, meta?: { recipient: string; purpose: string }): void {
  const prior = AdelanteEHR.activeConsentRecord(patientId);
  const sections = [...(prior?.sections ?? []).filter((s) => s.category !== "legal_part2_disclosure"), { category: "legal_part2_disclosure" as const, authorized: true }];
  AdelanteEHR.createConsentRecord({
    patientId, formType: prior?.formType ?? "AB133", source: "in person — consent tab", signedByName, attested: true,
    effectiveDate: new Date().toISOString().slice(0, 10), sections, capturedBy: { staffId: actor.staffId, staffName: actor.name, role: actor.role },
  });
  const d: LegalDisclosure = {
    id: `ld-${disclosures.length + 1}-${Date.now().toString(36)}`, patientId,
    recipient: meta?.recipient ?? "Not specified", purpose: meta?.purpose ?? "Referral for treatment",
    recordedAt: new Date().toISOString(), recordedBy: actor.name,
  };
  disclosures.push(d);
  audit("legal_disclosure_recorded", patientId, actor, { disclosureId: d.id, recipient: d.recipient });
}

/** B1/B2 demo: an allergy override on Daniel, a CURES check on Luis's buprenorphine. */
export function seedOrderSafetyDemo(): void {
  const BAGGA = { by: "Dr. M. Bagga", role: "physician" };
  try {
    const daniel = AdelanteEHR.listPatients().find((p) => p.firstName === "Daniel");
    if (daniel) {
      const o = AdelanteEHR.addDraftOrder(daniel.id, { drugName: "Amoxicillin 500 MG Oral Capsule", productName: "Amoxicillin 500 MG Oral Capsule", ingredientNames: ["amoxicillin"], createdBy: BAGGA.by } as never) as unknown as { id: string };
      AdelanteEHR.overrideOrderAllergy(daniel.id, o.id, { reason: "Tolerated amoxicillin in 2025 per outside records; monitoring (demo)", ...BAGGA });
      // Walk-through drafts: a same-class allergy match still to decide, and a
      // Schedule IV draft that can't be signed without the CURES step.
      AdelanteEHR.addDraftOrder(daniel.id, { drugName: "Ampicillin 500 MG Oral Capsule", productName: "Ampicillin 500 MG Oral Capsule", ingredientNames: ["ampicillin"], createdBy: BAGGA.by } as never);
      AdelanteEHR.addDraftOrder(daniel.id, { drugName: "Lorazepam 0.5 MG Oral Tablet", productName: "Lorazepam 0.5 MG Oral Tablet", ingredientNames: ["lorazepam"], isControlled: true, deaSchedule: "CIV", createdBy: BAGGA.by } as never);
    }
    const luis = AdelanteEHR.listPatients().find((p) => p.firstName === "Luis");
    const bup = luis?.orders?.find((o) => /buprenorph|suboxone/i.test(o.drugName) && o.status === "signed");
    if (luis && bup && !bup.curesCheck) {
      const at = new Date(Date.now() - 2 * 86400000);
      AdelanteEHR.recordCuresCheck(luis.id, bup.id, { checkedAt: at.toISOString().slice(0, 16), result: "no_concerns", note: "No other prescribers in the last 12 months (demo).", ...BAGGA });
    }
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[demo seed] order safety", e);
  }
}

/** Demo seed through the functions above. */
export function seedOutpatientCareDemo(): void {
  const safe = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (typeof console !== "undefined") console.warn("[demo seed] outpatient care", e);
    }
  };
  const REYES = { name: "Marisol Reyes", role: "therapist", staffId: "s-th1" };
  const find = (first: string) => AdelanteEHR.listPatients().find((p) => p.firstName === first);
  const programFor: Record<string, EpisodeProgram> = { Luis: "outpatient_sud", Jordan: "outpatient_sud", Marcus: "outpatient_sud", Carmen: "ecm" };
  for (const first of ["Rosa", "Daniel", "Luis", "Alicia", "Marcus", "Jordan", "Carmen"]) {
    const p = find(first);
    if (p && !activeEpisode(p.id)) safe(() => void openEpisode({ patientId: p.id, program: programFor[first] ?? "outpatient_mh", actor: REYES, at: p.enrolledAt ?? undefined }));
  }
  // Discharged then readmitted: Alicia.
  const alicia = find("Alicia");
  if (alicia)
    safe(() => {
      dischargeEpisode({ patientId: alicia.id, reason: "lost_to_contact", summary: "No contact for 60 days despite outreach; closed per policy. (Demo)", actor: REYES, confirmCancelVisits: true });
      readmit({ patientId: alicia.id, actor: REYES });
    });
  // Residential referral for Jordan: blocked for missing consent, then sent.
  const jordan = find("Jordan");
  if (jordan)
    safe(() => {
      const r = createHlocReferral({ patientId: jordan.id, target: "residential", reason: "Escalating use despite weekly outpatient care (demo)", urgency: "urgent", destination: "Tulare Recovery House (residential, demo)", outsideSudProvider: true, actor: REYES });
      try {
        advanceHlocReferral(r.id, "sent", REYES);
      } catch {
        /* expected: blocked, audited */
      }
      recordLegalDisclosureConsent(jordan.id, REYES, `${jordan.firstName} ${jordan.lastName}`, { recipient: r.destination, purpose: "Referral to residential treatment" });
      advanceHlocReferral(r.id, "sent", REYES);
    });
}

/** §Batch E — patient-linked rows a merge moves (patient merge only). */
export function _mergeRows(): Record<string, { patientId: string }[]> {
  return { episodes, referrals, disclosures };
}
