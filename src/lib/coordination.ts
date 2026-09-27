// §Item 6 — Clinical Coordination actions. Every coordinator decision goes
// through here: role check, reason, Part 2-safe notifications, audit.
import { AdelanteEHR, STAFF_CANCEL_REASON_LABEL, type Appointment, type StaffCancelReason } from "@/lib/ehr";
import { AdelanteEHRExt, type ClinicianProfileExt } from "@/lib/ehr-ext";
import { STAFF_ROSTER, getSupervisor, requiresSupervision, type StaffRole } from "@/lib/roles";

import { canActOnCoordination } from "@/lib/coordinationRoles";
export { COORDINATION_ROLES, canActOnCoordination } from "@/lib/coordinationRoles";

export interface CoordActor {
  name: string;
  role: StaffRole;
  id?: string;
}

export const REASSIGN_REASONS = {
  provider_frozen: "Provider frozen / on leave",
  provider_unavailable: "Provider unavailable",
  caseload_balance: "Caseload balance",
  patient_preference: "Patient preference",
  other: "Other",
} as const;
export type ReassignReason = keyof typeof REASSIGN_REASONS;

/** Soft cap on upcoming 1:1 visits — "capacity where known". */
export const UPCOMING_CAPACITY = 30;

function assertActor(actor: CoordActor) {
  if (!canActOnCoordination(actor.role))
    throw new Error("Only a clinical coordinator or system administrator can act on Clinical Coordination.");
}

function staffForClinician(clinicianId: string) {
  return STAFF_ROSTER.find((s) => s.clinicianId === clinicianId);
}

function upcomingLoad(clinicianId: string): number {
  const now = Date.now();
  return AdelanteEHR.listAppointments().filter(
    (a) => a.clinicianId === clinicianId && a.status === "scheduled" && +new Date(a.start) > now,
  ).length;
}

export interface ReassignOption {
  clinicianId: string;
  name: string;
  credential: string;
  trainee: boolean;
  supervisorName?: string;
  upcoming: number;
}

/** Only clinicians who are active, licensed, offer the service, have room, and are free at that time. */
export function eligibleReassignTargets(appt: Appointment): ReassignOption[] {
  const out: ReassignOption[] = [];
  for (const c of AdelanteEHR.listClinicians()) {
    if (c.id === appt.clinicianId) continue;
    if (AdelanteEHRExt.getClinicianProfile(c.id)?.active === false) continue;
    if (!AdelanteEHR.canBook(c.id).ok) continue;
    if (appt.serviceType && !(c.services ?? []).includes(appt.serviceType)) continue;
    const load = upcomingLoad(c.id);
    if (load >= UPCOMING_CAPACITY) continue;
    const clash = AdelanteEHR.listAppointments().some(
      (x) => x.id !== appt.id && x.clinicianId === c.id && x.status === "scheduled" && +new Date(x.start) === +new Date(appt.start),
    );
    if (clash) continue;
    const staff = staffForClinician(c.id);
    const trainee = staff ? requiresSupervision(staff.role) : false;
    const sup = trainee ? getSupervisor(staff!.id) : undefined;
    if (trainee && !sup) continue; // a trainee without a supervisor can't take coverage
    out.push({ clinicianId: c.id, name: c.name, credential: c.credential, trainee, supervisorName: sup?.name, upcoming: load });
  }
  return out;
}

function patientShort(patientId: string) {
  const p = AdelanteEHR.getPatient(patientId);
  return p ? `${p.firstName} ${p.lastName.slice(0, 1)}.` : "a patient";
}

function notifyClinician(clinicianId: string | undefined, subject: string, body: string, patientId: string) {
  if (!clinicianId) return;
  const staff = staffForClinician(clinicianId);
  if (!staff) return;
  AdelanteEHR.notify({ recipientStaffId: staff.id, category: "appointment_rescheduled", subject, body, patientId, linkRoute: "/schedule" });
}

export function reassignCoverage(input: {
  apptId: string;
  toClinicianId: string;
  reason: ReassignReason;
  note?: string;
  actor: CoordActor;
}) {
  assertActor(input.actor);
  const a = AdelanteEHR.listAppointments().find((x) => x.id === input.apptId);
  if (!a || a.status !== "scheduled") throw new Error("Only a scheduled visit can be reassigned.");
  if (!REASSIGN_REASONS[input.reason]) throw new Error("Pick a reason for reassigning.");
  if (input.reason === "other" && !input.note?.trim()) throw new Error("Describe the reason when you pick Other.");
  const target = eligibleReassignTargets(a).find((o) => o.clinicianId === input.toClinicianId);
  if (!target) throw new Error("That clinician isn't eligible for this visit.");
  const from = a.clinicianId;
  const fromName = AdelanteEHR.listClinicians().find((c) => c.id === from)?.name ?? "the previous clinician";
  AdelanteEHR.rescheduleAppointment(a.id, a.start, { clinicianId: target.clinicianId });
  const p = AdelanteEHR.getPatient(a.patientId);
  const primaryMoved = p?.primaryClinicianId === from;
  if (primaryMoved)
    AdelanteEHR.reassignPrimaryClinician({ patientId: a.patientId, clinicianId: target.clinicianId, initiatedBy: "admin", context: REASSIGN_REASONS[input.reason] });
  // Patient: generic "your visit changed" notice — no service, no clinical detail.
  AdelanteEHR.notifyAppointmentChange({ patientId: a.patientId, apptId: a.id, kind: "rescheduled" });
  // Clinicians: patient initials + date only; never the service or the free-text note (Part 2-safe).
  const when = new Date(a.start).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const reasonLabel = REASSIGN_REASONS[input.reason];
  const who = patientShort(a.patientId);
  notifyClinician(from, `Visit reassigned — ${who}`, `Your ${when} visit moved to ${target.name}. Reason: ${reasonLabel}.`, a.patientId);
  notifyClinician(target.clinicianId, `Visit reassigned to you — ${who}`, `You now have the ${when} visit (from ${fromName}). Reason: ${reasonLabel}.${target.supervisorName ? ` Supervisor: ${target.supervisorName}.` : ""}`, a.patientId);
  if (target.trainee && target.supervisorName) {
    const sup = STAFF_ROSTER.find((s) => s.name === target.supervisorName);
    if (sup) AdelanteEHR.notify({ recipientStaffId: sup.id, category: "appointment_rescheduled", subject: `Supervisee coverage — ${who}`, body: `${target.name} now covers the ${when} visit. Reason: ${reasonLabel}.`, patientId: a.patientId, linkRoute: "/schedule" });
  }
  AdelanteEHR.recordCoordinationAudit({
    action: "coordination_reassign",
    actorId: input.actor.id ?? input.actor.name,
    actorRole: input.actor.role,
    patientId: a.patientId,
    detail: {
      actorName: input.actor.name,
      apptId: a.id,
      from,
      to: target.clinicianId,
      reason: input.reason,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(target.supervisorName ? { supervisor: target.supervisorName } : {}),
      primaryMoved,
    },
  });
}

export function coordinationCancel(input: { apptId: string; reason: StaffCancelReason; note?: string; actor: CoordActor }) {
  assertActor(input.actor);
  const a = AdelanteEHR.listAppointments().find((x) => x.id === input.apptId);
  AdelanteEHR.staffCancelAppointment(input.apptId, { reason: input.reason, note: input.note, actor: input.actor });
  AdelanteEHR.recordCoordinationAudit({
    action: "coordination_cancel",
    actorId: input.actor.id ?? input.actor.name,
    actorRole: input.actor.role,
    patientId: a?.patientId,
    detail: { actorName: input.actor.name, apptId: input.apptId, reason: input.reason, ...(input.note?.trim() ? { note: input.note.trim() } : {}) },
  });
}

export function recordManualRebook(apptId: string, actor: CoordActor) {
  assertActor(actor);
  const a = AdelanteEHR.listAppointments().find((x) => x.id === apptId);
  AdelanteEHR.recordCoordinationAudit({
    action: "coordination_rebook_started",
    actorId: actor.id ?? actor.name,
    actorRole: actor.role,
    patientId: a?.patientId,
    detail: { actorName: actor.name, apptId, reason: "Manual rebook from coverage list" },
  });
}

export function updateCoordinationProfile(
  patch: Partial<ClinicianProfileExt> & { clinicianId: string },
  actor: CoordActor,
  reason: string,
) {
  assertActor(actor);
  if (!reason.trim()) throw new Error("Give a reason for the profile change.");
  const existed = Boolean(AdelanteEHRExt.getClinicianProfile(patch.clinicianId));
  AdelanteEHRExt.upsertClinicianProfile(patch);
  AdelanteEHR.recordCoordinationAudit({
    action: existed ? "coordination_profile_updated" : "coordination_profile_created",
    actorId: actor.id ?? actor.name,
    actorRole: actor.role,
    detail: { actorName: actor.name, clinicianId: patch.clinicianId, fields: Object.keys(patch).filter((k) => k !== "clinicianId"), reason: reason.trim() },
  });
}

export function setClinicianFrozen(clinicianId: string, frozen: boolean, actor: CoordActor, reason: string) {
  assertActor(actor);
  if (!reason.trim()) throw new Error("Give a reason.");
  AdelanteEHRExt.setClinicianActive(clinicianId, !frozen, reason.trim());
  AdelanteEHR.recordCoordinationAudit({
    action: frozen ? "coordination_provider_frozen" : "coordination_provider_unfrozen",
    actorId: actor.id ?? actor.name,
    actorRole: actor.role,
    detail: { actorName: actor.name, clinicianId, reason: reason.trim() },
  });
}

export const COORDINATION_ACTION_LABEL: Record<string, string> = {
  coordination_reassign: "Reassigned",
  coordination_cancel: "Cancelled",
  coordination_rebook_started: "Manual rebook",
  coordination_profile_created: "Profile created",
  coordination_profile_updated: "Profile updated",
  coordination_provider_frozen: "Provider frozen",
  coordination_provider_unfrozen: "Provider unfrozen",
};

export function listCoordinationAudit() {
  return AdelanteEHR.listAuditEvents({ category: "assignment" })
    .filter((e) => e.action.startsWith("coordination_"))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

export function reasonLabel(e: { action: string; detail?: Record<string, unknown> }): string {
  const r = String(e.detail?.reason ?? "");
  if (e.action === "coordination_reassign") return REASSIGN_REASONS[r as ReassignReason] ?? r;
  if (e.action === "coordination_cancel") return STAFF_CANCEL_REASON_LABEL[r as StaffCancelReason] ?? r;
  return r;
}

/** Patients with no active primary clinician (none set, or the primary is frozen). */
export function listUnassignedPatients() {
  const profiles = AdelanteEHRExt.listClinicianProfiles();
  const frozen = new Set(profiles.filter((p) => !p.active).map((p) => p.clinicianId));
  return AdelanteEHR.listPatients()
    .filter((p) => !p.primaryClinicianId || frozen.has(p.primaryClinicianId))
    .map((p) => ({ patient: p, why: p.primaryClinicianId ? "Primary clinician frozen" : "No primary clinician" }));
}

/** "First Last, Credential" — the one name format for credential exports. */
export function formatClinicianName(name: string, credential?: string): string {
  const base = name.replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, "").trim();
  return credential ? `${base}, ${credential}` : base;
}

let seeded = false;
/** Demo: Kayla's profile + credential, Dr. Okafor frozen with two affected patients. */
export function seedCoordinationDemo() {
  if (seeded) return;
  seeded = true;
  const priya: CoordActor = { name: "Priya Raman", role: "clinical_coordinator", id: "s-cc1" };
  const safe = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* demo seed is best-effort */
    }
  };
  safe(() =>
    updateCoordinationProfile(
      {
        clinicianId: "c4",
        specialty: "Supervised individual therapy (ASW trainee)",
        credentialType: "MSW",
        careTypes: ["therapy_individual", "case_management"],
        languages: ["English", "Vietnamese"],
        baseFacilityId: "fac-premier-tulare",
        active: true,
      },
      priya,
      "Trainee onboarding — coordination profile",
    ),
  );
  safe(() => {
    if (!AdelanteEHRExt.credentialsForClinician("c4").length)
      AdelanteEHRExt.addCredential({ clinicianId: "c4", kind: "license", issuingState: "CA", number: "ASW-120455", issuedAt: "2025-08-01", expiresAt: "2027-08-01", fileName: "asw_registration.pdf", uploadedBy: priya.name } as never);
  });
  // Two patients with upcoming therapy visits on Dr. Okafor, then freeze him.
  const pts = AdelanteEHR.listPatients().filter((p) => ["p1", "p2"].includes(p.id));
  const booked: string[] = [];
  pts.forEach((p, i) =>
    safe(() => {
      const d = new Date(Date.now() + (3 + i) * 86400000);
      d.setHours(14 + i, 0, 0, 0);
      const a = AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: "c2", start: d.toISOString(), durationMin: 50, serviceType: "therapy_individual", modality: "video", source: "staff_scheduled", allowPatientOverlap: true });
      AdelanteEHR.reassignPrimaryClinician({ patientId: p.id, clinicianId: "c2", initiatedBy: "admin", context: "Demo setup" });
      booked.push(a.id);
    }),
  );
  safe(() => setClinicianFrozen("c2", true, priya, "Unexpected leave — out through next week"));
  if (booked[0])
    safe(() => reassignCoverage({ apptId: booked[0]!, toClinicianId: "c1", reason: "provider_frozen", note: "Covering during Dr. Okafor's leave.", actor: priya }));
}
