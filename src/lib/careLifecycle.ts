// 27 Oct (Mitch) — ONE referral-to-billable-patient lifecycle.
// Draft — pending EHR/Admin audit.
//
// Pure derivation over records that already exist (referrals, patients,
// appointments, signed notes, Billing coverage projections, intake packet
// facts). It writes nothing and owns no store. Every surface that shows a
// referral/patient stage reads `lifecycleForReferral` / `lifecycleForPatient`.
//
// Rules:
//  • Eight stages, identical for every population (justice sources fold).
//  • A later fact never hides an earlier missing one: the stage is the furthest
//    exit reached, and every earlier unmet exit stays listed as a neutral gap.
//  • Labels are neutral — no SUD/consent wording. Standard Part 2 consent is
//    optional and never a stage condition.
//  • Clocks reuse the existing Draft thresholds (referralAging 3/7 for stages
//    1–4, POST_ENROLLMENT_STALENESS_DRAFT for 5–8).
import { AdelanteEHR, type Patient, type Referral } from "./ehr";
import { getStaffMember, STAFF_ROSTER, type StaffRole } from "./roles";
import { REFERRAL_AGING_DRAFT } from "./referralAging";
import { POST_ENROLLMENT_STALENESS_DRAFT, firstAttendedAppointment } from "./postEnrollment";
import { coverageProjection, coverageKeysForPatient } from "./coverageRequests";
import { didntStartCareFor } from "./lifecycleState";
import { referralClaimCodeConsumed } from "./identityReview";
import { getStructuredPlan } from "./structuredCarePlan";

export const LIFECYCLE_DRAFT = "Draft — pending EHR/Admin audit";

export const LIFECYCLE_STAGES = [
  { n: 1, key: "referred", name: "Referred" },
  { n: 2, key: "enrichment", name: "Record enrichment" },
  { n: 3, key: "outreach", name: "Outreach" },
  { n: 4, key: "enrolled", name: "Enrolled" },
  { n: 5, key: "paperwork", name: "Paperwork and coverage" },
  { n: 6, key: "visit_scheduled", name: "First visit scheduled" },
  { n: 7, key: "visit_attended", name: "First visit attended" },
  { n: 8, key: "active", name: "Active patient (billable)" },
] as const;
export type LifecycleStageKey = (typeof LIFECYCLE_STAGES)[number]["key"];

/** The open-ended 90-day clock start — pending Christi. Draft, configurable, unchanged behavior. */
export const NINETY_DAY_CLOCK_START_DRAFT: { start: "enrollment"; label: string } = {
  start: "enrollment",
  label: "Draft — 90-day clock starts at enrollment (current behavior), pending Christi",
};

export type LifecycleOwner = "Intake" | "Care team" | "Billing" | "Clinician" | "Care manager";

export interface LifecycleView {
  stage: number;
  key: LifecycleStageKey;
  name: string;
  /** Neutral missing facts, earliest first. */
  gaps: string[];
  owner: LifecycleOwner;
  ownerRoles: StaffRole[];
  nextAction: string;
  /** Days on the current clock (referral age for 1–4, since enrollment for 5–8). */
  days: number;
  clock: "fresh" | "due" | "overdue";
  closed?: { kind: "declined" | "didnt_start"; reason: string };
  patientId?: string;
  referralId?: string;
}

const INTAKE_OWNER_ROLES: StaffRole[] = ["intake_coordinator", "ecm_provider", "cf_care_manager", "clinical_coordinator"];
const CARE_TEAM_ROLES: StaffRole[] = ["ecm_provider", "cf_care_manager", "clinical_coordinator"];
const BILLING_ROLES: StaffRole[] = ["billing", "billing_coordinator"];
const CLINICIAN_ROLES: StaffRole[] = ["therapist", "pmhnp", "physician", "sud_counselor"];

// ---------------------------------------------------------------- facts

/** Actual identity evidence: staff-confirmed/identity-review record or a consumed claim code. DOB/confidence alone never counts. */
export function identityEvidence(r: Referral): "staff_confirmed" | "claim_code" | undefined {
  if (r.identityConfirmedBy?.at) return "staff_confirmed";
  if (referralClaimCodeConsumed(r.id)) return "claim_code";
  return undefined;
}

function referralFactsGathered(r: Referral): boolean {
  return !!(r.intakeStaging || r.dob || r.dobUnknown || r.cin || r.reportedBenefits || r.notes || r.intakeStaging?.referralReason);
}

function reached(r: Referral): boolean {
  return !!r.contactedAt || (r.outreach?.attempts ?? []).some((a) => a.outcome === "reached");
}

export function coverageForPatient(pid: string): { pathSet: boolean; verified: boolean } {
  const keys = coverageKeysForPatient(pid);
  const projections = keys.map(coverageProjection);
  return {
    pathSet: projections.some((p) => p.path !== "unknown"),
    verified: projections.some((p) => p.status === "Active" || p.status === "Self-pay" || p.status === "Sliding scale — tier set"),
  };
}

/** Attended service with a signed note whose rendering clinician has a roster credential (Draft proxy). */
export function billableService(pid: string) {
  const p = AdelanteEHR.getPatient(pid);
  const attended = AdelanteEHR.appointmentsForPatient(pid).filter((a) => a.status === "attended");
  const notes = p?.progressNotes ?? [];
  const signed = attended.find((a) => notes.some((n) => n.appointmentId === a.id && !!n.signedAt));
  const staff = signed ? STAFF_ROSTER.find((s) => s.clinicianId === signed.clinicianId) : undefined;
  return { attendedSigned: !!signed, credentialed: !!(staff && staff.credential) };
}

export function firstCarePlanDrafted(pid: string): boolean {
  try { return getStructuredPlan(pid).goals.length > 0; } catch { return false; }
}

// ---------------------------------------------------------------- derivation

interface Exit { met: boolean; gap: string }

function exitsFor(r: Referral | undefined, p: Patient | undefined): Exit[] {
  const pid = p?.id;
  const appts = pid ? AdelanteEHR.appointmentsForPatient(pid) : [];
  const cov = pid ? coverageForPatient(pid) : { pathSet: false, verified: false };
  const svc = pid ? billableService(pid) : { attendedSigned: false, credentialed: false };
  const identity = r ? !!identityEvidence(r) || !!pid : !!pid;
  return [
    { met: r ? !!(r.referralSource && r.identityConfidence !== undefined) || !!pid || !!r.referralSource : !!pid, gap: "Referral source not recorded" },
    { met: r ? (referralFactsGathered(r) && identity) || !!pid : !!pid, gap: identity ? "Referral facts not gathered" : "Identity not confirmed" },
    { met: r ? reached(r) || !!pid : !!pid, gap: "Not reached yet" },
    { met: !!pid, gap: "Not enrolled" },
    { met: !!p?.intakeCompletedAt && cov.pathSet, gap: !p?.intakeCompletedAt ? "Paperwork not finished" : "Coverage path not set" },
    { met: appts.some((a) => a.status === "scheduled" || a.status === "attended"), gap: "First visit not scheduled" },
    { met: !!(pid && firstAttendedAppointment(pid)) && !!p?.caseManagerId && !!p?.primaryClinicianId, gap: !(pid && firstAttendedAppointment(pid)) ? "First visit not attended" : !p?.caseManagerId ? "Care manager not assigned" : "Clinician not assigned" },
    { met: cov.verified && svc.attendedSigned && svc.credentialed, gap: !cov.verified ? "Coverage not verified" : !svc.attendedSigned ? "Signed visit note missing" : "Rendering clinician not credentialed" },
  ];
}

const NEXT: Record<number, { owner: LifecycleOwner; roles: StaffRole[]; action: string }> = {
  1: { owner: "Intake", roles: INTAKE_OWNER_ROLES, action: "Review the referral" },
  2: { owner: "Intake", roles: INTAKE_OWNER_ROLES, action: "Gather facts and confirm identity" },
  3: { owner: "Intake", roles: [...INTAKE_OWNER_ROLES, "peer_specialist"], action: "Reach the person" },
  4: { owner: "Intake", roles: INTAKE_OWNER_ROLES, action: "Enroll" },
  5: { owner: "Care team", roles: [...CARE_TEAM_ROLES, ...BILLING_ROLES], action: "Finish paperwork and coverage" },
  6: { owner: "Care team", roles: [...CARE_TEAM_ROLES, "intake_coordinator"], action: "Schedule the first visit" },
  7: { owner: "Care manager", roles: [...CARE_TEAM_ROLES, ...CLINICIAN_ROLES], action: "Hold the first visit" },
  8: { owner: "Billing", roles: [...BILLING_ROLES, ...CLINICIAN_ROLES], action: "Confirm billing readiness" },
};

function clockFor(stage: number, r: Referral | undefined, p: Patient | undefined, now: Date): { days: number; clock: LifecycleView["clock"] } {
  if (stage <= 4) {
    const start = r?.contactedAt ?? r?.createdAt;
    const days = start ? Math.max(0, Math.floor((+now - Date.parse(start)) / 86400_000)) : 0;
    return { days, clock: days >= REFERRAL_AGING_DRAFT.overdueDays ? "overdue" : days >= REFERRAL_AGING_DRAFT.dueDays ? "due" : "fresh" };
  }
  const start = p?.enrolledAt;
  const days = start ? Math.max(0, Math.floor((+now - Date.parse(start)) / 86400_000)) : 0;
  const t = stage === 5 ? POST_ENROLLMENT_STALENESS_DRAFT.intake : stage === 6 ? POST_ENROLLMENT_STALENESS_DRAFT.clinician : POST_ENROLLMENT_STALENESS_DRAFT.first_session;
  return { days, clock: days >= t.overdueDays ? "overdue" : days >= t.dueDays ? "due" : "fresh" };
}

function derive(r: Referral | undefined, p: Patient | undefined, now: Date): LifecycleView {
  const exits = exitsFor(r, p);
  let last = -1;
  exits.forEach((e, i) => { if (e.met) last = i; });
  const stageIdx = Math.min(7, last + 1);
  const stage = stageIdx + 1;
  const gaps = exits.slice(0, stageIdx).filter((e) => !e.met).map((e) => e.gap);
  if (stage === 8 && !exits[7].met) gaps.push(exits[7].gap);
  if (p && stage >= 6 && !firstCarePlanDrafted(p.id)) gaps.push("First care plan not drafted");
  const def = LIFECYCLE_STAGES[stageIdx];
  const next = NEXT[stage];
  const view: LifecycleView = {
    stage, key: def.key, name: def.name, gaps, owner: next.owner, ownerRoles: next.roles,
    nextAction: exits[stageIdx].met ? "Keep care going" : next.action,
    ...clockFor(stage, r, p, now),
    patientId: p?.id, referralId: r?.id,
  };
  if (r?.status === "declined") view.closed = { kind: "declined", reason: r.declineReason ?? "other" };
  const dsc = p ? didntStartCareFor(p.id) : undefined;
  if (dsc && !dsc.reopenedAt) view.closed = { kind: "didnt_start", reason: dsc.reason };
  return view;
}

export function lifecycleForReferral(r: Referral, now = new Date()): LifecycleView {
  const p = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined;
  return derive(r, p, now);
}

export function lifecycleForPatient(p: Patient, now = new Date()): LifecycleView {
  const r = AdelanteEHR.listReferrals().find((x) => x.enrolledPatientId === p.id);
  return derive(r, p, now);
}

/** "Your turn" only for the acting role among the stage owners. */
export function lifecycleTurn(v: LifecycleView, role: StaffRole): "yourturn" | "team" | "done" | "closed" {
  if (v.closed) return "closed";
  if (v.stage === 8 && !v.gaps.length) return "done";
  return v.ownerRoles.includes(role) ? "yourturn" : "team";
}

export function lifecycleChipLabel(v: LifecycleView): string {
  if (v.closed?.kind === "didnt_start") return "Didn't start care";
  if (v.closed) return "Closed";
  return `Stage ${v.stage} — ${v.name}${v.gaps.length ? ` · missing: ${v.gaps[0].toLowerCase()}` : ""}`;
}

/** Work homes: Intake stays in its workspace; Care Referrals owns 1–4; the record owns enrolled 5–8. */
export function lifecycleHome(v: LifecycleView, role: StaffRole): { to: string; params?: Record<string, string>; label: string } {
  if (role === "intake_coordinator") return { to: "/intake-workspace", label: "Open Intake workspace" };
  if (v.stage <= 4 || !v.patientId) return { to: "/referral-queue", label: "Open referrals" };
  return { to: "/record/$patientId", params: { patientId: v.patientId }, label: "Open record" };
}

// ---------------------------------------------------------------- readiness

export interface BillingReadiness {
  ready: boolean;
  checklist: { label: string; done: boolean }[];
}

/** Presentation only. Non-billing viewers receive checklist labels only — never payer detail. */
export function billingReadiness(pid: string): BillingReadiness {
  const p = AdelanteEHR.getPatient(pid);
  const cov = coverageForPatient(pid);
  const svc = billableService(pid);
  const checklist = [
    { label: "Coverage path set", done: cov.pathSet },
    { label: "Coverage verified", done: cov.verified },
    { label: "Attended visit with signed note", done: svc.attendedSigned },
    { label: "Rendering clinician credentialed", done: svc.credentialed },
    { label: "Intake packet finished", done: !!p?.intakeCompletedAt },
  ];
  return { ready: checklist.every((c) => c.done), checklist };
}

/** Names, never IDs, for an owner line. */
export function staffName(id?: string) { return getStaffMember(id)?.name; }
