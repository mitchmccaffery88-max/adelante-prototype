// §B1 — MAT continuity alert. Turns the passive refill runway into actions.
// Draft rules, one config. Never blocks, never auto-orders: a human decides.
// Part 2: no medication name in any task, notification, SMS or audit text.
// §B4: nothing here reads counseling attendance — MAT is never conditioned on it.
import { AdelanteEHR, type MedOrder, type Patient } from "./ehr";
import { isMatOrder, refillRunway } from "./medAdherence";
import { STAFF_ROSTER } from "./roles";
import { addWorkingDays, endOfDateKey, isSiteWorkingDay, primarySiteFor, siteTimezone, calendarOwnerFor } from "./workingCalendar";
import { facilityDateKey } from "./facilityTime";

export const MAT_CONTINUITY_DRAFT = {
  /** Runway at or below this, with no refill ordered → "MAT refill needed" task. */
  refillNeededDays: 5,
  /** Runway at or below this (or out) → "Medication continuity" escalation. */
  escalateDays: 2,
  /** Released MAT patient with no active order or bridge after this many days → escalation. */
  releaseBridgeDays: 1,
  /** Missed MAR doses looked back over this many days. */
  missedDoseLookbackDays: 7,
  label: "Draft — pending clinical sign-off",
} as const;

export const MAT_REFILL_TASK_LABEL = "MAT refill needed";
export const MAT_MISSED_DOSE_LABEL = "Missed dose — review";
export const MED_CONTINUITY_TYPE_LABEL = "Medication continuity";
export const PATIENT_REFILL_NUDGE = {
  en: { subject: "Time to refill?", body: "It may be time to refill a medication — tap to message your care team" },
  es: { subject: "¿Hora de surtir?", body: "Puede que sea hora de surtir un medicamento — toca para escribir a tu equipo de atención (Draft)" },
} as const;

export type ContinuityKind = "refill_needed" | "runway_critical" | "release_no_bridge" | "missed_dose";
export interface ContinuityAlert {
  key: string;
  kind: ContinuityKind;
  patientId: string;
  patientName: string;
  orderId?: string;
  /** Prescriber staff id; undefined → coordinator pool. */
  ownerStaffId?: string;
  ownerName?: string;
  daysLeft?: number;
  dueAt: string;
  /** Where the alert came from, shown next to it. */
  source: string;
  escalation: boolean;
}

const DAY = 86_400_000;
const pname = (p: Patient) => `${p.firstName} ${p.lastName}`;

function staff(id?: string) {
  if (!id) return undefined;
  return STAFF_ROSTER.find((m) => m.id === id && m.active !== false) ?? STAFF_ROSTER.find((m) => m.clinicianId === id && m.active !== false);
}
/** Prescriber of record, else the order's prescriber; undefined → coordinator pool. */
export function prescriberFor(p: Patient, o?: MedOrder) {
  return staff(p.prescriberStaffId) ?? staff(o?.orderingProviderId) ?? staff(o?.attestedBy) ?? staff(o?.createdBy);
}
/** "Same business day" on the prescriber's site calendar (end of today, or end of the next working day). */
export function sameBusinessDayDue(ownerStaffId: string | undefined, now: Date): string {
  const owner = calendarOwnerFor(ownerStaffId);
  const site = primarySiteFor(owner);
  const tz = siteTimezone(site);
  const today = facilityDateKey(now, tz);
  const day = isSiteWorkingDay(site, today) ? today : addWorkingDays(today, 1, { siteId: site });
  return endOfDateKey(day, tz).toISOString();
}

const REFILL_ORDERED = new Set(["pending", "approved", "sent_to_pharmacy"]);
function refillOrdered(p: Patient, o: MedOrder): boolean {
  const since = o.startDate ?? "";
  const words = [o.drugName, ...(o.ingredientNames ?? [])].join(" ").toLowerCase();
  return AdelanteEHR.listRefillRequests({ patientId: p.id }).some(
    (r) => REFILL_ORDERED.has(r.status) && (r.requestedAt ?? "").slice(0, 10) >= since && words.includes((r.medicationName ?? "").toLowerCase().split(/[\s-]/)[0] || "\u0000"),
  ) || (p.orders ?? []).some((x) => x.id !== o.id && isMatOrder(x) && (x.status === "signed" || x.status === "draft") && (x.startDate ?? "") > since);
}

/** Every open continuity alert. Pure read; recomputed each time. */
export function matContinuityAlerts(now: Date = new Date()): ContinuityAlert[] {
  const out: ContinuityAlert[] = [];
  const nowMs = +now;
  for (const p of AdelanteEHR.listPatients()) {
    const mats = (p.orders ?? []).filter(isMatOrder);
    if (!mats.length) continue;
    const signed = mats.filter((o) => o.status === "signed");
    // Runway — use the latest signed MAT order with a runway.
    const withRunway = signed.map((o) => ({ o, r: refillRunway(o, now) })).filter((x) => x.r).sort((a, b) => (b.r!.runsOutOn).localeCompare(a.r!.runsOutOn));
    const top = withRunway[0];
    if (top && top.r!.daysLeft <= MAT_CONTINUITY_DRAFT.refillNeededDays && !refillOrdered(p, top.o)) {
      const owner = prescriberFor(p, top.o);
      const critical = top.r!.daysLeft <= MAT_CONTINUITY_DRAFT.escalateDays;
      out.push({
        key: `${critical ? "runway_critical" : "refill_needed"}:${p.id}:${top.o.id}`,
        kind: critical ? "runway_critical" : "refill_needed",
        patientId: p.id, patientName: pname(p), orderId: top.o.id,
        ownerStaffId: owner?.id, ownerName: owner?.name, daysLeft: top.r!.daysLeft,
        dueAt: sameBusinessDayDue(owner?.id, now),
        source: `Refill runway from signed order (start ${top.o.startDate}, ${top.o.daysSupply}-day supply)`,
        escalation: critical,
      });
    }
    // Released with no active order or bridge.
    for (const ep of AdelanteEHR.listPreReleaseEpisodes(p.id)) {
      if (!ep.actualReleaseDate) continue;
      const rel = +new Date(`${ep.actualReleaseDate}T00:00:00`);
      if (nowMs < rel + MAT_CONTINUITY_DRAFT.releaseBridgeDays * DAY) continue;
      const active = signed.some((o) => { const r = refillRunway(o, now); return r ? r.daysLeft > 0 : true; });
      if (active) continue;
      const owner = prescriberFor(p, mats[0]);
      out.push({
        key: `release_no_bridge:${p.id}:${ep.id}`, kind: "release_no_bridge", patientId: p.id, patientName: pname(p),
        ownerStaffId: owner?.id, ownerName: owner?.name, dueAt: sameBusinessDayDue(owner?.id, now),
        source: `Released ${ep.actualReleaseDate} — no active order or bridge`, escalation: true,
      });
    }
    // Missed dose / pickup recorded on the MAR.
    for (const o of mats) {
      const missed = AdelanteEHR.listAdministrations(p.id, { orderId: o.id }).filter(
        (a) => (a.action === "refused" || a.action === "held") && !(a as { voided?: unknown }).voided && nowMs - +new Date(a.scheduledAt) <= MAT_CONTINUITY_DRAFT.missedDoseLookbackDays * DAY,
      );
      if (!missed.length) continue;
      const last = missed.map((a) => a.scheduledAt).sort().at(-1)!;
      const owner = prescriberFor(p, o);
      out.push({
        key: `missed_dose:${p.id}:${o.id}:${last}`, kind: "missed_dose", patientId: p.id, patientName: pname(p), orderId: o.id,
        ownerStaffId: owner?.id, ownerName: owner?.name, dueAt: sameBusinessDayDue(owner?.id, now),
        source: `MAR — ${missed.length} missed in ${MAT_CONTINUITY_DRAFT.missedDoseLookbackDays} days`, escalation: false,
      });
    }
  }
  return out;
}

export const continuityTaskLabel = (a: ContinuityAlert) => (a.kind === "missed_dose" ? MAT_MISSED_DOSE_LABEL : MAT_REFILL_TASK_LABEL);
export const continuityEscalations = (now: Date = new Date()) => matContinuityAlerts(now).filter((a) => a.escalation);
export const continuityTasks = (now: Date = new Date()) => matContinuityAlerts(now).filter((a) => !a.escalation);
export const continuityForPatient = (patientId: string, now: Date = new Date()) => matContinuityAlerts(now).filter((a) => a.patientId === patientId);

/** One-line text for the Brief (Adherence) and chart header, with its source. Caller masks by SUD access. */
export function continuityLine(a: ContinuityAlert): string {
  const what = a.kind === "release_no_bridge" ? "Released with no active order or bridge" : a.kind === "missed_dose" ? "Missed dose on the MAR" : a.daysLeft! <= 0 ? "Out of supply" : `${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} of supply left, no refill ordered`;
  return `${what} · source: ${a.source} (${MAT_CONTINUITY_DRAFT.label})`;
}

/**
 * Patient nudge — neutral, no medication name, deduped per alert. Sent through
 * the existing member-notification path. Returns true when a new one was sent.
 */
export function sendPatientRefillNudges(now: Date = new Date()): number {
  let n = 0;
  for (const a of matContinuityAlerts(now)) {
    if (a.kind !== "refill_needed" && a.kind !== "runway_critical") continue;
    const p = AdelanteEHR.getPatient(a.patientId);
    const lang = (p as { preferredLanguage?: string } | undefined)?.preferredLanguage?.toLowerCase().startsWith("es") ? "es" : "en";
    const copy = PATIENT_REFILL_NUDGE[lang];
    const before = AdelanteEHR.listMemberNotifications("patient", a.patientId).length;
    AdelanteEHR.notifyMember({ audience: "patient", recipientId: a.patientId, patientId: a.patientId, subject: copy.subject, body: copy.body, linkRoute: "/home", dedupeKey: `mat-nudge:${a.orderId}` });
    if (AdelanteEHR.listMemberNotifications("patient", a.patientId).length > before) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Seed — through store functions only. One MAT patient at 4 days of runway.
// ---------------------------------------------------------------------------
export const MAT_SEED_PATIENT = "Jasmine";
let seeded = false;
export function seedMatContinuityDemo(now: Date = new Date()): void {
  if (seeded) return;
  seeded = true;
  const p = AdelanteEHR.listPatients().find((x) => x.firstName === MAT_SEED_PATIENT && x.lastName === "Holt");
  if (!p || (p.orders ?? []).some(isMatOrder)) return;
  AdelanteEHR.setPrescriberOfRecord(p.id, "s-th3", "seed");
  const start = new Date(+now - 26 * DAY).toISOString().slice(0, 10);
  const o = AdelanteEHR.addDraftOrder(p.id, {
    drugName: "Buprenorphine-naloxone 8 MG-2 MG Sublingual Film", productName: "Buprenorphine-naloxone 8 MG-2 MG Sublingual Film",
    ingredientNames: ["buprenorphine", "naloxone"], isControlled: true, deaSchedule: "CIII", daysSupply: 30, startDate: start, createdBy: "s-th3",
  } as never);
  AdelanteEHR.signOrders(p.id, [o.id], "Anita Brooks");
  sendPatientRefillNudges(now);
}
seedMatContinuityDemo();

/** Brief (Adherence) text — rebuilt identically by adelBriefCheck. */
export const continuityBriefText = (a: ContinuityAlert) => `${a.escalation ? "Medication continuity escalation" : continuityTaskLabel(a)} — ${continuityLine(a)}`;
