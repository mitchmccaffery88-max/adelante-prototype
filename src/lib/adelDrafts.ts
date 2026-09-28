// §Chart redesign turn 5 — "Draft with Adel". Adel only DRAFTS; a person
// reviews, edits and signs/sends. Every draft here is RULE-BASED (templates
// over chart data — no AI model call) and carries ADEL_REVIEW_LABEL.
// Inputs are read only through the same Part 2-filtered helpers the chart
// uses (trackingTimeline, hieChartView, filterSudMedsForRole via visibleMeds,
// listLabOrders, openReferrals, roleSeesAsamSection), so a draft can never
// contain something the acting role can't already see. Nothing reaches the
// record without a human action, and every step is audited:
// adel_draft_drafted / _accepted / _edited / _discarded.
import { AdelanteEHR, refillNeedsCures, type Patient, type RefillRequest } from "@/lib/ehr";
import { canAccess, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { buildTrackingRows, latestFromHistory } from "@/lib/trackingTimeline";
import { CSSRS_KEY } from "@/lib/cssrs";
import { hieChartView, KIND_LABEL } from "@/lib/hie";
import { listLabOrders, listMetabolic, labTest, type LabOrder } from "@/lib/chartOrders";
import { staffPlanView, goalProgress } from "@/lib/structuredCarePlan";
import { headerAlerts, measureSeries, openReferrals, visibleMeds } from "@/lib/chartBrief";
import { listSideEffectReports } from "@/lib/medAdherence";
import { hlocSendBlocker, HLOC_TARGET_LABEL, type HlocReferral } from "@/lib/outpatientCare";

export const ADEL_REVIEW_LABEL = "Draft by Adel — review before saving";
export const ADEL_SOURCE_RULES = "Rule-based template (no AI)";
export const ADEL_THRESHOLDS_DRAFT = "Suggestion rules: Draft — pending clinical sign-off";
const DAY = 86400000;

export type AdelDraftKind = "progress_note" | "refill" | "outreach" | "referral_packet";
export type AdelDraftEvent = "drafted" | "accepted" | "edited" | "discarded";
export interface AdelActor {
  name: string;
  role: StaffRole | string;
}

export function adelDraftAudit(kind: AdelDraftKind, event: AdelDraftEvent, patientId: string, actor: AdelActor, detail: Record<string, unknown> = {}) {
  AdelanteEHR._recordAudit({
    category: "adel_draft",
    action: `adel_draft_${event}`,
    patientId,
    actorId: actor.name,
    actorRole: actor.role,
    // Never the draft text — metadata only.
    detail: { kind, source: ADEL_SOURCE_RULES, ...detail },
  });
}

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString();

// ---------------------------------------------------------------- progress note
export interface NoteDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}
export function lastSignedNoteAt(p: Patient): string | undefined {
  return (p.progressNotes ?? [])
    .filter((n) => !n.voidedAt && n.signedAt)
    .map((n) => n.signedAt!)
    .sort()
    .at(-1);
}
export function buildNoteDraft(p: Patient, role: StaffRole, now = new Date()): NoteDraft {
  const since = lastSignedNoteAt(p) ?? new Date(+now - 30 * DAY).toISOString();
  const appts = AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id);
  const today = appts.find((a) => new Date(a.start).toDateString() === now.toDateString());
  const visit = today ?? appts.filter((a) => +new Date(a.start) <= +now).sort((a, b) => b.start.localeCompare(a.start))[0];
  const reason = visit ? `${(visit.serviceType ?? "visit").replace(/_/g, " ")} on ${d(visit.start)}` : "follow-up visit";

  const changes: string[] = [];
  for (const r of buildTrackingRows(p, role, now).filter((r) => r.status === "completed" && r.date > since && r.score !== undefined))
    changes.push(`${r.label} ${r.score}${r.severity ? ` (${r.severity})` : ""} on ${d(r.date)}`);
  for (const o of visibleMeds(p, role).visible.filter((o) => (o.startDate ?? "") > since.slice(0, 10)))
    changes.push(`Medication started: ${o.drugName}${o.dose ? ` ${o.dose}` : ""}`);
  for (const e of hieChartView(p.id, role).encounters.filter((e) => e.at > since))
    changes.push(`${KIND_LABEL[e.kind]} at ${e.facility} on ${d(e.at)} (HIE, simulated)`);
  const goals = staffPlanView(p.id, role).goals.filter((g) => g.status === "active");
  for (const g of goals) changes.push(`Care-plan goal "${g.clinicalText}": ${goalProgress(p.id, g.id, now)}% progress`);

  const risk: string[] = [];
  const cs = latestFromHistory(p, CSSRS_KEY);
  risk.push(cs ? `C-SSRS ${cs.severity} on ${d(cs.completedAt)}` : "No C-SSRS on file");
  const sections = ["tracking", "outside-records", "appointments", "safety-plan", "alerts"];
  for (const a of headerAlerts(p, role, sections, now)) if (a.id !== "cssrs") risk.push(a.label);

  const plan: string[] = [];
  const lastSigned = (p.progressNotes ?? []).filter((n) => n.signedAt && !n.voidedAt).sort((a, b) => (b.signedAt ?? "").localeCompare(a.signedAt ?? ""))[0];
  if (lastSigned?.plan) plan.push(`Last note's plan (${d(lastSigned.signedAt!)}): ${lastSigned.plan.split("\n")[0]}`);
  // Today's check-in: participation only (mood content stays patient-private).
  const checkedToday = (p.checkIns ?? []).some((c) => new Date(c.date).toDateString() === now.toDateString());
  const next = appts.find((a) => a.status === "scheduled" && +new Date(a.start) > +now);
  plan.push(next ? `Next visit ${d(next.start)}.` : "Schedule next visit.");
  for (const l of listLabOrders(p.id, role).filter((l) => l.status === "pending")) plan.push(`Follow up pending ${labTest(l.testId)?.label} (due ${d(l.dueAt)}).`);
  for (const r of openReferrals(p, role)) plan.push(`Open referral: ${r.label} — ${r.status}.`);

  return {
    subjective: `Visit reason: ${reason}.${checkedToday ? " Patient completed a check-in today." : ""}\n[Clinician: add the patient's own report.]`,
    objective: changes.length ? `Changes since last note (${d(since)}):\n- ${changes.join("\n- ")}` : `No new scores, medication changes or outside events since ${d(since)}.`,
    assessment: `Current risk:\n- ${risk.join("\n- ")}\n[Clinician: add your assessment.]`,
    plan: plan.join("\n"),
  };
}
/** Accept → creates an unsigned draft note (authorSource ai_draft). Signing stays a human step. */
export function acceptNoteDraft(input: { patientId: string; draft: NoteDraft; original: NoteDraft; actor: AdelActor & { clinicianId?: string } }) {
  const edited = (Object.keys(input.draft) as (keyof NoteDraft)[]).some((k) => input.draft[k] !== input.original[k]);
  const note = AdelanteEHR.addProgressNote(input.patientId, {
    clinicianId: input.actor.clinicianId ?? input.actor.name,
    date: new Date().toISOString().slice(0, 10),
    sessionType: "individual",
    ...input.draft,
    authorSource: "ai_draft",
    status: "draft",
  });
  if (edited) adelDraftAudit("progress_note", "edited", input.patientId, input.actor, { noteId: note?.id });
  adelDraftAudit("progress_note", "accepted", input.patientId, input.actor, { noteId: note?.id, edited });
  return note;
}

// ---------------------------------------------------------------- refill
export type RefillSuggestion = "approve" | "approve_with_visit" | "deny";
export interface RefillSummary {
  lines: { label: string; value: string }[];
  controlled: boolean;
  curesDone: boolean;
  suggestion: RefillSuggestion;
  why: string;
}
const RELEVANT_LABS: [RegExp, string[]][] = [
  [/lithium/i, ["lithium", "cmp", "tsh"]],
  [/valpro|divalproex|depakote/i, ["valproate", "cmp"]],
  [/clozapine/i, ["cbc_anc"]],
  [/olanzapine|quetiapine|risperidone|aripiprazole|clozapine|ziprasidone/i, ["a1c", "lipid"]],
];
export function buildRefillSummary(r: RefillRequest, role: StaffRole, now = new Date()): RefillSummary {
  const p = AdelanteEHR.getPatient(r.patientId)!;
  const prior = AdelanteEHR.listRefillRequests({ patientId: r.patientId })
    .filter((x) => x.id !== r.id && x.medicationName === r.medicationName && x.status === "approved" && x.reviewedAt)
    .map((x) => x.reviewedAt!)
    .sort()
    .at(-1);
  const order = (p.orders ?? []).find((o) => o.id === r.medicationId || o.drugName === r.medicationName);
  const lastFill = prior ?? order?.startDate;
  const effects = listSideEffectReports(p.id).filter((s) => s.drugName === r.medicationName || s.orderId === order?.id);
  const controlled = refillNeedsCures(r);
  const cures = r.curesCheck ?? order?.curesCheck;
  const lastVisit = AdelanteEHR.listAppointments()
    .filter((a) => a.patientId === p.id && a.status === "attended" && +new Date(a.start) <= +now)
    .map((a) => a.start)
    .sort()
    .at(-1);
  const missed = AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id && a.status === "no_show" && +now - +new Date(a.start) <= 60 * DAY).length;
  const wanted = RELEVANT_LABS.filter(([re]) => re.test(r.medicationName)).flatMap(([, ids]) => ids);
  const labs: LabOrder[] = listLabOrders(p.id, role).filter((l) => wanted.includes(l.testId));
  const labText = labs.length
    ? labs.map((l) => (l.result ? `${labTest(l.testId)?.label} ${l.result.value} ${l.result.unit} (${l.result.flag}, ${d(l.result.date)})` : `${labTest(l.testId)?.label} pending`)).join("; ")
    : wanted.length ? "None on file — consider ordering" : "None needed for this medication";
  const adherence = missed ? `${missed} missed visit${missed === 1 ? "" : "s"} in 60 days; no dose self-reports` : "No missed visits in 60 days; no dose self-reports on file";

  const lines = [
    { label: "Last fill", value: lastFill ? d(lastFill) : "Not on file" },
    { label: "Adherence", value: adherence },
    { label: "Side effects", value: effects.length ? effects.map((e) => `${e.severity}: ${e.note}`).join("; ") : "None reported" },
    { label: "Controlled / MOUD", value: controlled ? "Yes — CURES required" : "No" },
    { label: "CURES", value: !controlled ? "Not required" : cures ? `${cures.emergencyOverride ? "Emergency override" : cures.result.replace(/_/g, " ")} · ${d(cures.checkedAt)}` : "Required — not yet recorded" },
    { label: "Last visit", value: lastVisit ? d(lastVisit) : "None on file" },
    { label: "Relevant labs", value: labText },
  ];
  let suggestion: RefillSuggestion = "approve";
  let why = "Active order, recent visit, no concerns found.";
  const abnormal = labs.some((l) => l.result && l.result.flag !== "normal");
  const overdueLab = labs.some((l) => l.status === "pending" && +new Date(l.dueAt) < +now);
  if (!order) {
    suggestion = "deny";
    why = "No active order on file for this medication — deny with reason and schedule a visit.";
  } else if (!lastVisit || +now - +new Date(lastVisit) > 90 * DAY || missed || abnormal || overdueLab || effects.some((e) => !e.acknowledgedAt) || (wanted.length && !labs.length)) {
    suggestion = "approve_with_visit";
    why = [
      (!lastVisit || +now - +new Date(lastVisit) > 90 * DAY) && "no visit in 90 days",
      missed && "recent missed visit",
      abnormal && "abnormal lab",
      overdueLab && "lab overdue",
      effects.some((e) => !e.acknowledgedAt) && "open side-effect report",
      wanted.length && !labs.length && "monitoring lab missing",
    ].filter(Boolean).join(", ");
    why = `Approve a short supply and book a visit: ${why}.`;
  }
  if (controlled && !cures && suggestion !== "deny") why += " Record the CURES check before approving.";
  return { lines, controlled, curesDone: !!cures, suggestion, why };
}

// ---------------------------------------------------------------- outreach
export type OutreachReason = "missed_visit" | "outside_event" | "contact_due";
export const OUTREACH_REASON_LABEL: Record<OutreachReason, string> = {
  missed_visit: "Missed visit",
  outside_event: "Outside ED visit / hospital stay",
  contact_due: "Overdue contact",
};
/**
 * Plain-language (about 3rd–5th grade), Part 2-safe patient message. Uses only
 * the first name and a generic reason — never diagnoses, medications, scores,
 * programs or facility names.
 */
export function buildOutreachDraft(p: Patient, reason: OutreachReason, lang: "en" | "es", staffName: string): string {
  const name = p.firstName;
  const me = staffName.split(" ")[0];
  if (lang === "es") {
    const body =
      reason === "missed_visit"
        ? "Te extrañamos en tu cita. Está bien, a veces pasan cosas. ¿Quieres elegir otro día?"
        : reason === "outside_event"
          ? "Supimos que fuiste al hospital hace poco. ¿Cómo estás? Queremos ayudarte con lo que necesites."
          : "Hace tiempo que no hablamos. ¿Cómo te va?";
    return `Hola ${name}, soy ${me} de tu equipo de Adelante. ${body} Contesta este mensaje o llámanos. Si estás en crisis, llama o manda texto al 988.`;
  }
  const body =
    reason === "missed_visit"
      ? "We missed you at your visit. That's okay — things come up. Want to pick a new time?"
      : reason === "outside_event"
        ? "We heard you went to the hospital recently. How are you doing? We want to help with anything you need."
        : "It's been a little while since we talked. How are things going?";
  return `Hi ${name}, this is ${me} from your Adelante care team. ${body} Reply here or give us a call. If you are in crisis, call or text 988.`;
}
export function canSendOutreach(role: StaffRole, p?: Patient): boolean {
  const a = canAccess(role, "patient_messaging", p);
  return a.level === "write" && !a.locked;
}
/** Which outreach reasons apply to this patient right now (role-filtered). */
export function outreachReasons(p: Patient, role: StaffRole, now = new Date()): OutreachReason[] {
  const out: OutreachReason[] = [];
  if (AdelanteEHR.listAppointments().some((a) => a.patientId === p.id && a.status === "no_show" && +now - +new Date(a.start) <= 30 * DAY)) out.push("missed_visit");
  if (hieChartView(p.id, role).encounters.some((e) => (e.kind === "ed_visit" || e.kind === "admission" || e.kind === "discharge") && +now - +new Date(e.at) <= 14 * DAY)) out.push("outside_event");
  out.push("contact_due");
  return out;
}
export function sendOutreach(input: { patientId: string; text: string; original: string; reason: OutreachReason; lang: "en" | "es"; actor: AdelActor }) {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!canSendOutreach(input.actor.role as StaffRole, p)) throw new Error("Your role can't message patients.");
  if (!input.text.trim()) throw new Error("The message is empty.");
  const edited = input.text.trim() !== input.original.trim();
  const msg = AdelanteEHR.sendStaffMessage(input.patientId, input.actor.name, input.text.trim(), input.actor.role as StaffRole);
  if (edited) adelDraftAudit("outreach", "edited", input.patientId, input.actor, { reason: input.reason, lang: input.lang });
  adelDraftAudit("outreach", "accepted", input.patientId, input.actor, { reason: input.reason, lang: input.lang, messageId: msg?.id, edited });
  return msg;
}

// ---------------------------------------------------------------- referral packet
export interface ReferralPacket {
  referralId: string;
  text: string;
  status: "attached" | "discarded";
  by: string;
  at: string;
}
const packets = new Map<string, ReferralPacket>();
export const referralPacket = (referralId: string) => packets.get(referralId);
export function buildReferralPacket(r: HlocReferral, role: StaffRole, now = new Date()): string {
  const p = AdelanteEHR.getPatient(r.patientId)!;
  const seesSud = roleSeesAsamSection(role, p);
  const problems = (p.problems ?? []).filter((x) => x.status === "active" && (seesSud || x.category !== "sud"));
  const meds = visibleMeds(p, role);
  const phq = measureSeries(p, role, "phq-9").at(-1);
  const gad = measureSeries(p, role, "gad-7").at(-1);
  const met = listMetabolic(p.id).at(-1);
  const lines = [
    `Referral summary — ${HLOC_TARGET_LABEL[r.target]} at ${r.destination}`,
    `Patient: ${p.firstName} ${p.lastName}${p.dob ? `, DOB ${p.dob}` : ""}`,
    `Urgency: ${r.urgency}. Reason: ${r.reason}`,
    `Active problems: ${problems.length ? problems.map((x) => `${x.description}${x.icd10Code ? ` (${x.icd10Code})` : ""}`).join("; ") : "none on file"}`,
    `Medications: ${meds.visible.length ? meds.visible.map((o) => `${o.drugName}${o.dose ? ` ${o.dose}` : ""}`).join("; ") : "none on file"}${meds.hidden ? " (some medications not shown for your role)" : ""}`,
    `Recent measures: ${[phq && `PHQ-9 ${phq.score} (${d(phq.date)})`, gad && `GAD-7 ${gad.score} (${d(gad.date)})`, met && `BP ${met.bpSystolic}/${met.bpDiastolic}, BMI ${met.bmi}`].filter(Boolean).join("; ") || "none on file"}`,
  ];
  if (seesSud) {
    const asam = (p.asamAssessments ?? []).filter((a) => a.signedAt).sort((a, b) => (b.signedAt ?? "").localeCompare(a.signedAt ?? ""))[0];
    lines.push(`ASAM level: ${asam?.actualLevel ? `${asam.actualLevel} (signed ${d(asam.signedAt!)})` : "none signed"}`);
  }
  const blocker = hlocSendBlocker(r);
  lines.push(`Consent: ${r.outsideSudProvider ? (blocker ? "Part 2 disclosure consent NOT on file — sending is blocked" : "Part 2 disclosure consent on file") : "Standard release (not an outside SUD provider)"}`);
  lines.push(`Prepared ${now.toLocaleDateString()}. ${ADEL_REVIEW_LABEL}.`);
  return lines.join("\n");
}
export function attachReferralPacket(r: HlocReferral, text: string, original: string, actor: AdelActor): ReferralPacket {
  const edited = text.trim() !== original.trim();
  const pk: ReferralPacket = { referralId: r.id, text: text.trim(), status: "attached", by: actor.name, at: new Date().toISOString() };
  packets.set(r.id, pk);
  if (edited) adelDraftAudit("referral_packet", "edited", r.patientId, actor, { referralId: r.id });
  adelDraftAudit("referral_packet", "accepted", r.patientId, actor, { referralId: r.id, edited });
  AdelanteEHR._emit();
  return pk;
}
export function discardAdelDraft(kind: AdelDraftKind, patientId: string, actor: AdelActor, detail: Record<string, unknown> = {}) {
  adelDraftAudit(kind, "discarded", patientId, actor, detail);
}
export function _resetAdelDrafts() {
  packets.clear();
}
