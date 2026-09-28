// §Chart redesign turn 3 — compact header + "Brief" landing tab. Everything
// here is DERIVED from data the chart already shows, filtered with the same
// Part 2 rules (roleSeesAsamSection, trackingTimeline, hieChartView,
// filterSudMedsForRole, chartOrders). The only new stores are the sticky note
// (audited) and a per-user "last opened Adel Brief" stamp.
import { AdelanteEHR, type Patient, type MedOrder } from "@/lib/ehr";
import { canAccess, CRISIS_FLAG_ROLES, STAFF_ROSTER, isPrescriberRole, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection, filterSudMedsForRole } from "@/lib/asamReporting";
import { buildTrackingRows, latestFromHistory } from "@/lib/trackingTimeline";
import { CSSRS_KEY } from "@/lib/cssrs";
import { hieChartView, hieDraftFor } from "@/lib/hie";
import { listLabOrders, listMetabolic, listScreenerRequests, screenerRequestStatus, labTest } from "@/lib/chartOrders";
import { isJusticeInvolved } from "@/lib/justiceInvolvement";
import { planReviewDue, getStructuredPlan, staffPlanView, planNeeds } from "@/lib/structuredCarePlan";
import { getSafetyPlan } from "@/lib/safetyPlan";
import { mediCalStatusApplies } from "@/lib/coverageStatus";
import { isInFacilityTask } from "@/lib/inFacility";
import { chartActionState } from "@/lib/chartActions";
import { listHlocReferrals } from "@/lib/outpatientCare";
import { isReferralOpen } from "@/lib/noteAutofill";

export const BRIEF_DRAFT_LABEL = "Draft by Adel — verify";
export const BANDS_DRAFT_LABEL = "Colour bands: Draft — pending clinical sign-off";
export const STICKY_HINT = "Non-clinical only — no clinical or substance use details.";
const DAY = 86400000;

// ---------------------------------------------------------------- sticky note
export interface StickyNote {
  text: string;
  by: string;
  at: string;
}
const sticky = new Map<string, StickyNote>();
/** Staff roles with patient contact edit (same list as the crisis flag). */
export const canEditSticky = (role: string) => (CRISIS_FLAG_ROLES as readonly string[]).includes(role);
export const canReadSticky = (role: string, p?: Patient) => canAccess(role as StaffRole, "demographics", p).level !== "none";
export const getStickyNote = (patientId: string) => sticky.get(patientId);
export function setStickyNote(patientId: string, text: string, actor: { name: string; role: string }): void {
  if (!canEditSticky(actor.role)) throw new Error("Your role can't edit the sticky note.");
  if (!AdelanteEHR.getPatient(patientId)) throw new Error("Patient not found.");
  const t = text.trim().slice(0, 120);
  if (t) sticky.set(patientId, { text: t, by: actor.name, at: new Date().toISOString() });
  else sticky.delete(patientId);
  AdelanteEHR._recordAudit({ category: "sticky_note", action: t ? "sticky_note_set" : "sticky_note_cleared", patientId, actorId: actor.name, actorRole: actor.role, detail: { length: t.length } });
  AdelanteEHR._emit();
}

// ---------------------------------------------------------------- last seen
const seen = new Map<string, string>();
export const briefLastSeen = (staffId: string, patientId: string) => seen.get(`${staffId}:${patientId}`);
export function markBriefSeen(staffId: string, patientId: string, at = new Date()) {
  seen.set(`${staffId}:${patientId}`, at.toISOString());
  AdelanteEHR._emit();
}

// ---------------------------------------------------------------- identity helpers
export function ageFromDob(dob?: string, now = new Date()): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(+d)) return undefined;
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
  return a;
}
/** "Reentry day N" — only when justice-involved and within 90 days of release. */
export function reentryDay(p: Patient, now = new Date()): number | undefined {
  if (!isJusticeInvolved(p)) return undefined;
  const z = (p.problems ?? []).find((x) => x.status === "active" && x.icd10Code === "Z65.2");
  const when = p.releaseDate || z?.onsetDate || z?.createdAt;
  if (!when) return undefined;
  const t = +new Date(when);
  if (Number.isNaN(t) || t > +now) return undefined;
  const days = Math.floor((+now - t) / DAY);
  return days <= 90 ? days + 1 : undefined;
}
export function mediCalChip(p: Patient): "active" | "needs_check" | undefined {
  const c = p.coverage;
  if (!c || !mediCalStatusApplies(c.coverageType as never)) return undefined;
  return c.status === "active" && c.verified === "verified" ? "active" : "needs_check";
}

export interface TeamChip {
  role: "prescriber" | "therapist" | "case_manager";
  label: string;
  name: string;
}
export function careTeam(p: Patient): TeamChip[] {
  const out: TeamChip[] = [];
  const orderPeople = new Set((p.orders ?? []).flatMap((o: MedOrder) => [o.attestedBy, o.createdBy].filter(Boolean) as string[]));
  const presc =
    STAFF_ROSTER.find((s) => s.id === p.prescriberStaffId) ??
    STAFF_ROSTER.find((s) => isPrescriberRole(s.role) && [...orderPeople].some((n) => n.includes(s.name) || s.name.includes(n)));
  if (presc) out.push({ role: "prescriber", label: "Prescriber", name: presc.name });
  const clin = p.primaryClinicianId ? AdelanteEHR.getClinician(p.primaryClinicianId) : undefined;
  if (clin) out.push({ role: "therapist", label: "Therapist", name: clin.name });
  const cm = AdelanteEHR.getCaseManager(p.caseManagerId);
  if (cm) out.push({ role: "case_manager", label: "Case manager / ECM", name: cm.name });
  return out;
}

// ---------------------------------------------------------------- events (recent activity + what changed + glow)
export interface ChartEvent {
  at: string;
  label: string;
  sectionId: string;
}
export function chartEvents(p: Patient, role: StaffRole, now = new Date()): ChartEvent[] {
  const ev: ChartEvent[] = [];
  for (const r of buildTrackingRows(p, role, now))
    if (r.status === "completed") ev.push({ at: r.date, label: `${r.label}${r.score !== undefined ? ` ${r.score}` : ""}${r.severity ? ` · ${r.severity}` : ""}`, sectionId: "tracking" });
  for (const e of hieChartView(p.id, role).encounters)
    ev.push({ at: e.at, label: `${e.kind === "ed_visit" ? "ED visit" : e.kind === "admission" ? "Hospital admission" : e.kind === "discharge" ? "Hospital discharge" : "Outside visit"} — ${e.facility} (HIE)`, sectionId: "outside-records" });
  for (const o of listLabOrders(p.id, role)) {
    ev.push({ at: o.orderedAt, label: `${labTest(o.testId)?.label} ordered`, sectionId: "tracking" });
    if (o.result) ev.push({ at: new Date(o.result.date).toISOString(), label: `${labTest(o.testId)?.label} ${o.result.value} ${o.result.unit} (${o.result.flag})`, sectionId: "tracking" });
  }
  for (const m of listMetabolic(p.id)) ev.push({ at: m.at, label: `BP ${m.bpSystolic}/${m.bpDiastolic}, BMI ${m.bmi}`, sectionId: "tracking" });
  if (canAccess(role, "case_notes", p).level !== "none")
    for (const a of AdelanteEHR.listAppointments().filter((x) => x.patientId === p.id && +new Date(x.start) <= +now))
      if (a.status === "attended" || a.status === "no_show")
        ev.push({ at: a.start, label: a.status === "attended" ? "Visit attended" : "Missed visit", sectionId: "appointments" });
  const plan = getStructuredPlan(p.id);
  if (plan.review.signedAt) ev.push({ at: plan.review.signedAt, label: `Care plan signed (v${plan.review.version})`, sectionId: "care-plan" });
  return ev.filter((e) => !Number.isNaN(+new Date(e.at)) && +new Date(e.at) <= +now).sort((a, b) => b.at.localeCompare(a.at));
}
export function briefHasNew(p: Patient, role: StaffRole, staffId: string, now = new Date()): boolean {
  const last = briefLastSeen(staffId, p.id);
  const top = chartEvents(p, role, now)[0];
  if (!top) return false;
  return !last || top.at > last;
}

// ---------------------------------------------------------------- header alerts
export interface HeaderAlert {
  id: string;
  label: string;
  sectionId: string;
  tone: "red" | "amber";
}
const md = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
export function headerAlerts(p: Patient, role: StaffRole, visibleSections: string[], now = new Date()): HeaderAlert[] {
  const out: HeaderAlert[] = [];
  const cs = latestFromHistory(p, CSSRS_KEY);
  if (cs && /high|moderate/i.test(cs.severity))
    out.push({ id: "cssrs", label: `C-SSRS ${/high/i.test(cs.severity) ? "high" : "moderate"} risk ${md(cs.completedAt)}`, sectionId: "tracking", tone: /high/i.test(cs.severity) ? "red" : "amber" });
  for (const e of hieChartView(p.id, role).encounters) {
    const days = Math.floor((+now - +new Date(e.at)) / DAY);
    if ((e.kind === "ed_visit" || e.kind === "admission") && days <= 14) {
      out.push({ id: `hie-${e.id}`, label: `${e.kind === "ed_visit" ? "ED visit" : "Admission"} ${days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`} (HIE)`, sectionId: "outside-records", tone: "amber" });
      break;
    }
  }
  const missed = AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id && a.status === "no_show" && +now - +new Date(a.start) <= 60 * DAY).length;
  if (missed > 0) out.push({ id: "missed", label: `${missed} missed visit${missed === 1 ? "" : "s"}`, sectionId: "appointments", tone: "amber" });
  const sp = getSafetyPlan(p.id);
  if (sp && (!sp.lastReviewedAt || +now - +new Date(sp.lastReviewedAt) > 90 * DAY))
    out.push({ id: "safety", label: "Safety plan due for review", sectionId: "safety-plan", tone: "amber" });
  if (canAccess(role, "alerts", p).level !== "none")
    for (const a of (p.alerts ?? []).filter((x) => !x.removedAt && x.active !== false))
      out.push({ id: `al-${a.id}`, label: a.label, sectionId: "alerts", tone: a.severity === "critical" ? "red" : "amber" });
  return out.filter((a) => visibleSections.includes(a.sectionId));
}

// ---------------------------------------------------------------- due now
export type Discipline = "prescriber" | "therapy" | "case";
export interface DueRow {
  id: string;
  label: string;
  due: string;
  discipline: Discipline;
  sectionId?: string;
  actionId?: string;
}
export function roleDiscipline(role: string): Discipline {
  if (role === "physician" || role === "pmhnp") return "prescriber";
  if (["therapist", "clinical_trainee", "sud_counselor"].includes(role)) return "therapy";
  return "case";
}
export function dueNow(p: Patient, role: StaffRole, now = new Date()): DueRow[] {
  const rows: DueRow[] = [];
  const seesSud = roleSeesAsamSection(role, p);
  if (canAccess(role, "case_notes", p).level !== "none")
    for (const t of AdelanteEHR.listCaseTasks().filter((x) => x.patientId === p.id && !x.completedAt && x.status !== "done")) {
      if (isInFacilityTask(t as never)) continue;
      if (t.origin === "asam_needed" && !seesSud) continue;
      rows.push({ id: `t-${t.id}`, label: t.title, due: t.dueDate, discipline: "case", sectionId: "tasks" });
    }
  for (const o of listLabOrders(p.id, role).filter((x) => x.status === "pending"))
    rows.push({ id: `l-${o.id}`, label: `${labTest(o.testId)?.label} — result pending`, due: o.dueAt, discipline: "prescriber", sectionId: "tracking" });
  for (const r of listScreenerRequests(p.id, role).filter((x) => screenerRequestStatus(x, now) !== "completed"))
    rows.push({ id: `s-${r.id}`, label: `${r.key.toUpperCase()} requested — waiting on patient`, due: r.dueAt, discipline: "therapy", sectionId: "tracking" });
  if (canAccess(role, "care_plan", p).level !== "none" && planReviewDue(p.id, now))
    rows.push({ id: "plan", label: "Care plan review", due: getStructuredPlan(p.id).review.reviewDueAt!, discipline: "therapy", sectionId: "care-plan" });
  for (const e of hieChartView(p.id, role).encounters) {
    const d = hieDraftFor(e.id);
    if (d?.status === "draft") rows.push({ id: `h-${e.id}`, label: "Outside event — follow up (HIE)", due: new Date(+new Date(e.at) + 2 * DAY).toISOString(), discipline: "case", sectionId: "outside-records" });
  }
  if (canAccess(role, "case_notes", p).level !== "none")
    for (const a of AdelanteEHR.listAppointments().filter((x) => x.patientId === p.id && x.status === "scheduled" && +new Date(x.start) >= +now - DAY && +new Date(x.start) <= +now + 7 * DAY))
      rows.push({ id: `a-${a.id}`, label: `Visit ${new Date(a.start).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`, due: a.start, discipline: "therapy", sectionId: "appointments" });
  return rows.sort((a, b) => a.due.localeCompare(b.due));
}
export type Bucket = "past" | "today" | "week";
export function bucketOf(due: string, now = new Date()): Bucket | undefined {
  const d = new Date(due.length === 10 ? `${due}T12:00:00` : due);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY);
  if (+d < +start) return "past";
  if (+d < +end) return "today";
  if (+d < +end + 7 * DAY) return "week";
  return undefined;
}

// ---------------------------------------------------------------- measures
export type Band = "red" | "amber" | "green";
export const scoreBand = (key: string, score: number): Band =>
  key === "phq-9" || key === "gad-7" ? (score >= 15 ? "red" : score >= 10 ? "amber" : "green") : "green";
export function measureSeries(p: Patient, role: StaffRole, key: string) {
  return buildTrackingRows(p, role)
    .filter((r) => r.key === key && r.status === "completed" && r.score !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, score: r.score! }));
}

// ---------------------------------------------------------------- cards
export type BriefCard = "due" | "measures" | "meds" | "problems" | "visits" | "careplan" | "needs" | "outside" | "referrals";
export function roleCardOrder(role: string): BriefCard[] {
  const lead: BriefCard[] =
    role === "physician" || role === "pmhnp"
      ? ["due", "measures", "meds", "problems", "visits"]
      : ["therapist", "clinical_trainee", "sud_counselor"].includes(role)
        ? ["due", "measures", "careplan", "visits", "problems"]
        : role === "ecm_provider" || role === "cf_care_manager"
          ? ["due", "needs", "visits", "outside", "careplan"]
          : role === "peer_specialist" || role === "community_health_worker"
            ? ["due", "needs", "visits", "careplan"]
            : role === "clinical_coordinator"
              ? ["due", "visits", "referrals", "outside"]
              : ["due", "visits", "problems"];
  const all: BriefCard[] = ["due", "measures", "problems", "meds", "careplan", "visits", "needs", "outside", "referrals"];
  return [...lead, ...all.filter((c) => !lead.includes(c))];
}
export function visibleMeds(p: Patient, role: StaffRole) {
  const active = (p.orders ?? []).filter((o) => o.status === "signed");
  return filterSudMedsForRole(active, role, p);
}
export function openReferrals(p: Patient, role: StaffRole) {
  const seesSud = roleSeesAsamSection(role, p);
  const hloc = listHlocReferrals(p.id).filter((r) => !["declined", "closed", "admitted"].includes(r.status) && (seesSud || !r.sudRelated));
  const res = canAccess(role, "sdoh", p).level !== "none" ? (p.resourceReferrals ?? []).filter((r) => isReferralOpen(r)) : [];
  return [
    ...hloc.map((r) => ({ id: r.id, label: `${r.target.replace(/_/g, " ")} referral — ${r.destination || "destination pending"}`, status: r.status, sectionId: "episodes" })),
    ...res.map((r) => ({ id: r.id, label: `${r.category.replace(/_/g, " ")} — ${r.provider}`, status: String(r.status), sectionId: "episodes" })),
  ];
}

// ---------------------------------------------------------------- Adel Brief
export interface BriefAction {
  actionId: string;
  label: string;
}
export function adelBrief(p: Patient, role: StaffRole, staffId: string, episodeLabel: string | undefined, now = new Date()) {
  const bullets: string[] = [];
  if (episodeLabel) bullets.push(`In care: ${episodeLabel}.`);
  const phq = measureSeries(p, role, "phq-9").at(-1);
  const gad = measureSeries(p, role, "gad-7").at(-1);
  if (phq || gad)
    bullets.push([phq && `PHQ-9 ${phq.score}`, gad && `GAD-7 ${gad.score}`].filter(Boolean).join(", ") + ` (last ${md((phq ?? gad)!.date)}).`);
  const view = staffPlanView(p.id, role);
  const active = view.goals.filter((g) => g.status === "active").length;
  if (active) bullets.push(`${active} active care-plan goal${active === 1 ? "" : "s"}${planReviewDue(p.id, now) ? "; plan review is due" : ""}.`);
  const needs = planNeeds(p.id).filter((n) => n.step !== "Completed").length;
  if (needs && canAccess(role, "sdoh", p).level !== "none") bullets.push(`${needs} open social need${needs === 1 ? "" : "s"}.`);
  const rd = reentryDay(p, now);
  if (rd) bullets.push(`Reentry day ${rd}.`);
  const next = AdelanteEHR.listAppointments().find((a) => a.patientId === p.id && a.status === "scheduled" && +new Date(a.start) >= +now);
  if (next && canAccess(role, "case_notes", p).level !== "none") bullets.push(`Next visit ${new Date(next.start).toLocaleDateString()}.`);

  const lastVisit = AdelanteEHR.listAppointments()
    .filter((a) => a.patientId === p.id && a.status === "attended" && +new Date(a.start) <= +now)
    .map((a) => a.start)
    .sort()
    .at(-1);
  const since = lastVisit ?? briefLastSeen(staffId, p.id) ?? new Date(+now - 30 * DAY).toISOString();
  const changed = chartEvents(p, role, now).filter((e) => e.at > since).slice(0, 6);

  const actions: BriefAction[] = [];
  const add = (actionId: string, label: string) => {
    if (!actions.some((a) => a.actionId === actionId) && chartActionState(actionId, { role, staffId }, p).state !== "hidden") actions.push({ actionId, label });
  };
  const rows = dueNow(p, role, now);
  if (rows.some((r) => r.id.startsWith("h-"))) add("task", "Add an outreach task");
  if (listScreenerRequests(p.id, role).some((r) => screenerRequestStatus(r, now) === "overdue") || (phq && +now - +new Date(phq.date) > 30 * DAY)) add("screener_request", "Request a PHQ-9");
  if (planReviewDue(p.id, now)) add("care_plan_goal", "Review the care plan");
  if (needs) add("sdoh_referral", "Make an SDOH referral");
  add("progress_note", "Write a progress note");
  add("message_patient", "Message the patient");
  return { bullets: bullets.slice(0, 5), changed, since, actions: actions.slice(0, 4) };
}
export function _resetChartBrief() {
  sticky.clear();
  seen.clear();
}
