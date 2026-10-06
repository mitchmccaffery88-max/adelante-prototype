// §Faster Adel Brief (Demo 2) — four fixed, narrow sections computed in the
// background and refreshed incrementally.
//
// - Each section is a small function with a FIXED scope (no free-form
//   prompt) returning at most 3 bullets. Every bullet carries the chart
//   section it came from (source chip) and the date of its data.
// - Results are cached per patient AND role-visibility class
//   (role + whether that role passes the Part 2 check for this patient), so
//   Part 2 filtering is never shared across roles that see different things.
// - Each cache entry keeps a "computed as of" time and an input fingerprint
//   per source. On a store change only sections whose sources changed are
//   recomputed (SECTION_DEPS). A cache hit does no record reads at all.
// - Part 2: every read goes through the existing filters
//   (filterSudMedsForRole, buildTrackingRows, staffPlanView, hieChartView,
//   listLabOrders, openReferrals, roleSeesAsamSection). No note bodies are
//   ever read — notes contribute a COUNT of unsigned notes only.
// Draft — pending clinical sign-off (section scope, thresholds).
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { canAccess, isPrescriberRole, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection, filterSudMedsForRole } from "@/lib/asamReporting";
import { buildTrackingRows } from "@/lib/trackingTimeline";
import { hieChartView, hieDraftFor } from "@/lib/hie";
import { listLabOrders, listScreenerRequests, screenerRequestStatus, labTest } from "@/lib/chartOrders";
import { getStructuredPlan, planNeeds, planReviewDue, staffPlanView } from "@/lib/structuredCarePlan";
import { getSafetyPlan } from "@/lib/safetyPlan";
import { listHlocReferrals } from "@/lib/outpatientCare";
import { isReferralOpen } from "@/lib/noteAutofill";
import { refillRunway, isMatOrder, listSelfReports } from "@/lib/medAdherence";
import { moodCheckInDayCount } from "@/lib/moodCheckInCount";
import { computeCheckInStreak } from "@/lib/checkInStreak";
import { aiConsentStatus } from "@/lib/scribe";
import { chartActionState } from "@/lib/chartActions";
import { reentryDay, briefLastSeen, type BriefAction } from "@/lib/chartBrief";
import { SimulatedLlmAdapter, type LlmSentence } from "@/lib/vendors/llm";

const DAY = 86400000;
export const BRIEF_SECTION_CAP = 3;
export const BRIEF_ACTION_CAP = 4;
export const BRIEF_SECTIONS_DRAFT = "Section scope and thresholds: Draft — pending clinical sign-off";

export type BriefSectionId = "adherence" | "engagement" | "visit_focus" | "care_gaps";
export const BRIEF_SECTIONS: { id: BriefSectionId; title: string }[] = [
  { id: "adherence", title: "Adherence" },
  { id: "engagement", title: "Engagement" },
  { id: "visit_focus", title: "Visit focus" },
  { id: "care_gaps", title: "Care gaps" },
];

export type BriefSource =
  | "day" | "orders" | "refills" | "dose_reports" | "screeners" | "appointments" | "messages" | "checkins"
  | "patient" | "plan" | "sdoh" | "safety" | "notes" | "referrals" | "consents" | "hie" | "labs";

/** Source → sections dependency map (inverted below). */
export const SECTION_DEPS: Record<BriefSectionId, BriefSource[]> = {
  adherence: ["day", "orders", "refills", "dose_reports", "screeners"],
  engagement: ["day", "appointments", "messages", "checkins", "patient"],
  visit_focus: ["day", "plan", "screeners", "refills", "orders", "labs", "hie"],
  care_gaps: ["day", "screeners", "plan", "safety", "sdoh", "notes", "referrals", "consents"],
};
export const SOURCE_TO_SECTIONS: Record<BriefSource, BriefSectionId[]> = (() => {
  const out = {} as Record<BriefSource, BriefSectionId[]>;
  for (const [sec, srcs] of Object.entries(SECTION_DEPS) as [BriefSectionId, BriefSource[]][])
    for (const s of srcs) (out[s] ??= []).push(sec);
  return out;
})();
const ALL_SOURCES = Object.keys(SOURCE_TO_SECTIONS) as BriefSource[];
const ACTION_DEPS: BriefSource[] = ["day", "refills", "screeners", "plan", "sdoh", "appointments", "hie", "referrals"];

const SECTION_LABEL: Record<string, string> = {
  medications: "Medications", tracking: "Tracking", appointments: "Visits", messages: "Messages",
  "care-plan": "Care plan", "safety-plan": "Safety plan", notes: "Notes", episodes: "Referrals",
  consents: "Consents", "outside-records": "Outside records", demographics: "Profile", sdoh: "Social needs",
};
export const sourceChipLabel = (sectionId: string) => SECTION_LABEL[sectionId] ?? sectionId;

export interface BriefBullet {
  id: string;
  text: string;
  /** ISO date/time of the data this bullet came from. */
  at: string;
  /** Chart section the source chip links to. */
  sectionId: string;
}
export interface BriefSectionResult {
  id: BriefSectionId;
  bullets: BriefBullet[];
  computedAt: string;
}

// ---------------------------------------------------------------- helpers
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const md = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString([], { month: "short", day: "numeric" });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const maxAt = (xs: (string | undefined)[], fallback: string) => xs.filter(Boolean).sort().at(-1) ?? fallback;
const seesVisits = (role: StaffRole, p: Patient) => canAccess(role, "case_notes", p).level !== "none";
const apptsFor = (pid: string) => AdelanteEHR.listAppointments().filter((a) => a.patientId === pid);
function visibleOrders(p: Patient, role: StaffRole) {
  return filterSudMedsForRole((p.orders ?? []).filter((o) => o.status === "signed"), role, p).visible;
}
function visibleRefills(p: Patient, role: StaffRole) {
  const meds = visibleOrders(p, role);
  const ids = new Set(meds.map((o) => o.id));
  const names = new Set(meds.map((o) => o.drugName.toLowerCase()));
  // Only refills that map to a medication this role can see — unmatched ones are hidden, never stubbed.
  return AdelanteEHR.listRefillRequests({ patientId: p.id, status: "pending" }).filter(
    (r) => ids.has(r.medicationId) || names.has(r.medicationName.toLowerCase()),
  );
}
function series(p: Patient, role: StaffRole, key: string) {
  return buildTrackingRows(p, role)
    .filter((r) => r.key === key && r.status === "completed" && r.score !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------- the four fixed sections
/** Adherence: med adherence (runway / missed doses), MAT continuity, overdue re-screens. */
export function computeAdherence(p: Patient, role: StaffRole, now: Date): BriefBullet[] {
  const out: BriefBullet[] = [];
  const nowIso = now.toISOString();
  if (canAccess(role, "meds_erx", p).level !== "none") {
    const meds = visibleOrders(p, role);
    const seesSud = roleSeesAsamSection(role, p);
    for (const o of meds) {
      const r = refillRunway(o, now);
      const name = o.drugName;
      if (!r || r.tone === "ok") continue;
      if (isMatOrder(o) && seesSud && r.tone === "out")
        out.push({ id: `mat-${o.id}`, text: `MAT continuity gap — ${name} supply ran out ${md(r.runsOutOn)}.`, at: r.runsOutOn, sectionId: "medications" });
      else out.push({ id: `run-${o.id}`, text: r.tone === "out" ? `${name} supply ran out ${md(r.runsOutOn)}.` : `${name} runs out in ${plural(r.daysLeft, "day")}.`, at: o.startDate ?? nowIso, sectionId: "medications" });
    }
    const ids = new Set(meds.map((o) => o.id));
    const since = +now - 14 * DAY;
    const missed = listSelfReports(p.id).filter((s) => ids.has(s.orderId) && s.status === "not_taken" && +new Date(s.scheduledAt) >= since && +new Date(s.scheduledAt) <= +now);
    if (missed.length)
      out.push({ id: "missed", text: `${plural(missed.length, "missed dose")} self-reported in the last 14 days.`, at: maxAt(missed.map((m) => m.scheduledAt), nowIso), sectionId: "medications" });
  }
  const overdue = listScreenerRequests(p.id, role).filter((r) => screenerRequestStatus(r, now) === "overdue");
  if (overdue.length)
    out.push({ id: "rescreen-overdue", text: `Overdue re-screen: ${overdue.map((r) => r.key.toUpperCase()).join(", ")}.`, at: maxAt(overdue.map((r) => r.dueAt), nowIso), sectionId: "tracking" });
  return out.slice(0, BRIEF_SECTION_CAP);
}

/** Engagement: attended vs missed (30/60 d), check-in streak, messages, days since contact, reentry day. */
export function computeEngagement(p: Patient, role: StaffRole, now: Date): BriefBullet[] {
  const out: BriefBullet[] = [];
  const nowIso = now.toISOString();
  const past = seesVisits(role, p) ? apptsFor(p.id).filter((a) => +new Date(a.start) <= +now) : [];
  if (seesVisits(role, p)) {
    const win = (d: number) => past.filter((a) => +now - +new Date(a.start) <= d * DAY);
    const a30 = win(30), a60 = win(60);
    const att = (xs: typeof past) => xs.filter((a) => a.status === "attended").length;
    const miss = (xs: typeof past) => xs.filter((a) => a.status === "no_show").length;
    if (a60.length)
      out.push({ id: "visits", text: `Visits: ${att(a30)} attended / ${miss(a30)} missed (30 d); ${att(a60)} / ${miss(a60)} (60 d).`, at: maxAt(a60.map((a) => a.start), nowIso), sectionId: "appointments" });
  }
  const rd = reentryDay(p, now);
  if (rd) out.push({ id: "reentry", text: `Reentry day ${rd}.`, at: p.releaseDate ?? nowIso, sectionId: "demographics" });
  const msgs = seesVisits(role, p) ? AdelanteEHR.listCareMessages(p.id) : [];
  const lastAttended = past.filter((a) => a.status === "attended").map((a) => a.start).sort().at(-1);
  const lastStaffMsg = msgs.filter((m) => m.authorType === "staff").map((m) => m.createdAt).sort().at(-1);
  const lastContact = [lastAttended, lastStaffMsg].filter(Boolean).sort().at(-1);
  if (lastContact)
    out.push({ id: "contact", text: `${plural(Math.max(0, Math.floor((+now - +new Date(lastContact)) / DAY)), "day")} since last contact.`, at: lastContact, sectionId: lastContact === lastStaffMsg ? "messages" : "appointments" });
  // Check-in participation: day COUNTS only (moodCheckInCount) — never mood content.
  const keys: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = ymd(new Date(+now - i * DAY));
    if (moodCheckInDayCount(p.id, d, d) > 0) keys.push(d);
  }
  if (keys.length) {
    const n = computeCheckInStreak(keys, ymd(now)).days;
    out.push({ id: "checkins", text: `Check-ins: ${plural(keys.length, "day")} in last 30${n ? `; ${n}-day streak` : ""}.`, at: `${keys[0]}T12:00:00`, sectionId: "tracking" });
  }
  const fromPt = msgs.filter((m) => m.authorType === "patient" && +now - +new Date(m.createdAt) <= 30 * DAY);
  if (fromPt.length)
    out.push({ id: "msgs", text: `${plural(fromPt.length, "message")} from the patient in the last 30 days.`, at: maxAt(fromPt.map((m) => m.createdAt), nowIso), sectionId: "messages" });
  return out.slice(0, BRIEF_SECTION_CAP);
}

/** Visit focus: measure changes, open goals, open refills, pending results, outside events. */
export function computeVisitFocus(p: Patient, role: StaffRole, now: Date): BriefBullet[] {
  const out: BriefBullet[] = [];
  const nowIso = now.toISOString();
  for (const key of ["phq-9", "gad-7"]) {
    const s = series(p, role, key);
    const last = s.at(-1), prev = s.at(-2);
    if (!last) continue;
    const label = key.toUpperCase();
    if (prev && prev.score !== undefined) {
      const d = last.score! - prev.score;
      const dir = d < 0 ? "improving" : d > 0 ? "worsening" : "no change";
      out.push({ id: `m-${key}`, text: `${label} ${prev.score} → ${last.score} (${d > 0 ? "+" : ""}${d}, ${dir}).`, at: last.date, sectionId: "tracking" });
    } else out.push({ id: `m-${key}`, text: `${label} ${last.score} — first score on file.`, at: last.date, sectionId: "tracking" });
  }
  if (isPrescriberRole(role) || canAccess(role, "meds_erx", p).level !== "none") {
    const refills = visibleRefills(p, role);
    if (refills.length)
      out.push({ id: "refills", text: `Open refill request: ${refills.map((r) => r.medicationName).join(", ")}.`, at: maxAt(refills.map((r) => r.requestedAt), nowIso), sectionId: "medications" });
  }
  const pending = listLabOrders(p.id, role).filter((o) => o.status === "pending");
  if (pending.length)
    out.push({ id: "labs", text: `Pending result: ${pending.map((o) => labTest(o.testId)?.label ?? "lab").join(", ")}.`, at: maxAt(pending.map((o) => o.orderedAt), nowIso), sectionId: "tracking" });
  const enc = hieChartView(p.id, role).encounters.filter((e) => +now - +new Date(e.at) <= 30 * DAY && +new Date(e.at) <= +now);
  if (enc.length) {
    const e = [...enc].sort((a, b) => b.at.localeCompare(a.at))[0];
    out.push({ id: "hie", text: `Outside event: ${e.kind.replace(/_/g, " ")} at ${e.facility} (HIE).`, at: e.at, sectionId: "outside-records" });
  }
  if (canAccess(role, "care_plan", p).level !== "none") {
    const goals = staffPlanView(p.id, role).goals.filter((g) => g.status === "active");
    if (goals.length) {
      const g = goals[0];
      out.push({ id: `goal-${g.id}`, text: `Check progress on goal: ${g.clinicalText}${goals.length > 1 ? ` (+${goals.length - 1} more)` : ""}.`, at: (g as { updatedAt?: string; createdAt?: string }).updatedAt ?? (g as { createdAt?: string }).createdAt ?? nowIso, sectionId: "care-plan" });
    }
  }
  return out.slice(0, BRIEF_SECTION_CAP);
}

/** Care gaps: rescreens due, plan/safety review, SDOH, unsigned notes, referrals, consents. */
export function computeCareGaps(p: Patient, role: StaffRole, now: Date): BriefBullet[] {
  const out: BriefBullet[] = [];
  const nowIso = now.toISOString();
  const phq = series(p, role, "phq-9").at(-1);
  if (phq && +now - +new Date(phq.date) > 30 * DAY)
    out.push({ id: "phq-due", text: `PHQ-9 re-screen due (last ${md(phq.date)}).`, at: phq.date, sectionId: "tracking" });
  if (canAccess(role, "care_plan", p).level !== "none") {
    if (planReviewDue(p.id, now)) {
      const due = getStructuredPlan(p.id).review.reviewDueAt ?? nowIso;
      out.push({ id: "plan-review", text: `Care-plan review due ${md(due)}.`, at: due, sectionId: "care-plan" });
    }
  }
  if (canAccess(role, "safety_plan", p).level !== "none") {
    const sp = getSafetyPlan(p.id);
    const last = sp?.lastReviewedAt ?? sp?.updatedAt;
    if (last && +now - +new Date(last) > 90 * DAY)
      out.push({ id: "safety-review", text: `Safety plan review due (last ${md(last)}).`, at: last, sectionId: "safety-plan" });
  }
  if (canAccess(role, "sdoh", p).level !== "none") {
    const n = planNeeds(p.id).filter((x) => x.step !== "Completed").length;
    if (n) out.push({ id: "sdoh", text: `${plural(n, "open social need")}.`, at: (p as { sdohPlan?: { updatedAt?: string } }).sdohPlan?.updatedAt ?? nowIso, sectionId: "care-plan" });
  }
  if (seesVisits(role, p)) {
    // COUNT only — note bodies are never read here.
    const unsigned = (p.progressNotes ?? []).filter((n) => n.status !== "signed" && !n.signedAt);
    if (unsigned.length) out.push({ id: "unsigned", text: `${plural(unsigned.length, "unsigned note")}.`, at: maxAt(unsigned.map((n) => n.date), nowIso), sectionId: "notes" });
  }
  const seesSud = roleSeesAsamSection(role, p);
  const hloc = listHlocReferrals(p.id).filter((r) => !["declined", "closed", "admitted"].includes(r.status) && (seesSud || !r.sudRelated));
  const res = canAccess(role, "sdoh", p).level !== "none" ? (p.resourceReferrals ?? []).filter((r) => isReferralOpen(r)) : [];
  if (hloc.length + res.length)
    out.push({ id: "referrals", text: `${plural(hloc.length + res.length, "open referral")}.`, at: maxAt([...hloc.map((r) => (r as { createdAt?: string }).createdAt), ...res.map((r) => (r as { createdAt?: string }).createdAt)], nowIso), sectionId: "episodes" });
  if (canAccess(role, "demographics", p).level !== "none") {
    const missing: string[] = [];
    if (aiConsentStatus(p.id, now).state !== "active") missing.push("AI recording");
    // Part 2 consent gap is itself SUD information — only for roles that pass the Part 2 check.
    if (seesSud && !AdelanteEHR.getConsentState(p.id).part2Sud) missing.push("Part 2");
    if (missing.length) out.push({ id: "consents", text: `Consent not on file: ${missing.join(", ")}.`, at: nowIso, sectionId: "consents" });
  }
  return out.slice(0, BRIEF_SECTION_CAP);
}

const COMPUTE: Record<BriefSectionId, (p: Patient, r: StaffRole, now: Date) => BriefBullet[]> = {
  adherence: computeAdherence,
  engagement: computeEngagement,
  visit_focus: computeVisitFocus,
  care_gaps: computeCareGaps,
};

/** Suggested actions — registry-gated (chartActionState), max 4. */
export function computeBriefActions(p: Patient, role: StaffRole, staffId: string, now: Date): BriefAction[] {
  const actions: BriefAction[] = [];
  const add = (actionId: string, label: string) => {
    if (!actions.some((a) => a.actionId === actionId) && chartActionState(actionId, { role, staffId }, p).state !== "hidden") actions.push({ actionId, label });
  };
  const hieDraft = hieChartView(p.id, role).encounters.some((e) => hieDraftFor(e.id)?.status === "draft");
  if (hieDraft) add("task", "Add an outreach task");
  const phq = series(p, role, "phq-9").at(-1);
  if (listScreenerRequests(p.id, role).some((r) => screenerRequestStatus(r, now) === "overdue") || (phq && +now - +new Date(phq.date) > 30 * DAY)) add("screener_request", "Request a PHQ-9");
  if (planReviewDue(p.id, now)) add("care_plan_goal", "Review the care plan");
  if (planNeeds(p.id).some((n) => n.step !== "Completed")) add("sdoh_referral", "Make an SDOH referral");
  if (isPrescriberRole(role) && AdelanteEHR.listRefillRequests({ patientId: p.id, status: "pending" }).length) add("refill_decision", "Review refill — Adel summary ready");
  if (hieDraft || apptsFor(p.id).some((a) => a.status === "no_show" && +now - +new Date(a.start) <= 30 * DAY)) add("message_patient", "Draft outreach with Adel");
  if (listHlocReferrals(p.id).some((r) => r.status === "drafted" && (roleSeesAsamSection(role, p) || !r.sudRelated))) add("hloc_referral", "Draft referral packet with Adel");
  add("progress_note", "Draft a progress note with Adel");
  add("message_patient", "Message the patient");
  return actions.slice(0, BRIEF_ACTION_CAP);
}

// ---------------------------------------------------------------- fingerprints (cheap, per source)
function h(s: string): string {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0;
  return `${s.length}:${x}`;
}
function sourceFingerprint(src: BriefSource, p: Patient, role: StaffRole, now: Date): string {
  switch (src) {
    case "day": return ymd(now);
    case "orders": return h((p.orders ?? []).map((o) => `${o.id}|${o.status}|${o.startDate}|${o.daysSupply}`).join(","));
    case "refills": return h(AdelanteEHR.listRefillRequests({ patientId: p.id }).map((r) => `${r.id}|${r.status}`).join(","));
    case "dose_reports": return h(listSelfReports(p.id).map((s) => `${s.orderId}|${s.scheduledAt}|${s.status}`).join(","));
    case "screeners": return h(`${(p.screenerHistory ?? []).map((s) => `${(s as { key?: string }).key}|${(s as { date?: string; completedAt?: string }).date ?? (s as { completedAt?: string }).completedAt}`).join(",")}#${(p.missedScreeners ?? []).length}#${listScreenerRequests(p.id).map((r) => r.id).join(",")}`);
    case "appointments": return h(apptsFor(p.id).map((a) => `${a.id}|${a.status}|${a.start}`).join(","));
    case "messages": { const m = p.careMessages ?? []; return `${m.length}|${m.at(-1)?.createdAt ?? ""}`; }
    case "checkins": return String(moodCheckInDayCount(p.id, ymd(new Date(+now - 30 * DAY)), ymd(now)));
    case "patient": return h(`${p.releaseDate}|${(p.problems ?? []).map((x) => `${x.icd10Code}|${x.status}`).join(",")}`);
    case "plan": { const pl = getStructuredPlan(p.id); return h(`${pl.review.version}|${pl.review.signedAt}|${pl.review.reviewDueAt}|${pl.goals.map((g) => `${g.id}|${g.status}|${g.clinicalText}`).join(",")}`); }
    case "sdoh": return h(`${planNeeds(p.id).map((n) => `${n.id}|${n.step}`).join(",")}#${(p.resourceReferrals ?? []).map((r) => `${r.id}|${r.status}`).join(",")}`);
    case "safety": { const s = getSafetyPlan(p.id); return `${s?.updatedAt ?? ""}|${s?.lastReviewedAt ?? ""}`; }
    case "notes": return h((p.progressNotes ?? []).map((n) => `${n.id}|${n.status}|${n.signedAt ?? ""}`).join(","));
    case "referrals": return h(listHlocReferrals(p.id).map((r) => `${r.id}|${r.status}`).join(","));
    case "consents": return h(`${AdelanteEHR.listConsentRecords(p.id).length}|${AdelanteEHR.getConsentState(p.id).part2Sud}|${aiConsentStatus(p.id, now).state}`);
    case "hie": return h(hieChartView(p.id, role).encounters.map((e) => `${e.id}|${hieDraftFor(e.id)?.status ?? ""}`).join(","));
    case "labs": return h(listLabOrders(p.id, role).map((o) => `${o.id}|${o.status}|${o.result ? 1 : 0}`).join(","));
  }
}

// ---------------------------------------------------------------- cache
export interface BriefCacheEntry {
  key: string;
  patientId: string;
  role: StaffRole;
  /** Store version at which this entry was last validated. */
  version: number;
  fingerprint: Partial<Record<BriefSource, string>>;
  sections: Partial<Record<BriefSectionId, BriefSectionResult>>;
  computedAsOf?: string;
  /** Sections currently recomputing in the background. */
  refreshing: Set<BriefSectionId>;
}
const cache = new Map<string, BriefCacheEntry>();
const actionCache = new Map<string, { fp: string; actions: BriefAction[] }>();
let storeVersion = 0;
const listeners = new Set<() => void>();
let snapshotTick = 0;
function notify() {
  snapshotTick++;
  for (const l of listeners) l();
}
export const subscribeBrief = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const briefSnapshot = () => snapshotTick;

/** Instrumentation — unit tests and the dev timing log read these. */
export const briefStats = { hits: 0, fullComputes: 0, sectionComputes: { adherence: 0, engagement: 0, visit_focus: 0, care_gaps: 0 } as Record<BriefSectionId, number>, fingerprintPasses: 0 };
export function _resetBriefStats() {
  briefStats.hits = 0;
  briefStats.fullComputes = 0;
  briefStats.fingerprintPasses = 0;
  for (const k of Object.keys(briefStats.sectionComputes) as BriefSectionId[]) briefStats.sectionComputes[k] = 0;
}

/** Role-visibility class: role + Part 2 outcome for this patient. Never shared across roles. */
export function visibilityClass(p: Patient, role: StaffRole) {
  return `${role}|sud:${roleSeesAsamSection(role, p) ? 1 : 0}`;
}
const keyOf = (p: Patient, role: StaffRole) => `${p.id}|${visibilityClass(p, role)}`;

let subscribed = false;
function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  AdelanteEHR.subscribe(() => {
    storeVersion++;
    scheduleBackgroundRefresh();
  });
}

function devLog(label: string, ms: number) {
  if (import.meta.env?.DEV && import.meta.env?.MODE !== "test") console.debug(`[adel-brief] ${label} ${ms.toFixed(1)} ms`);
}
const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function computeSection(entry: BriefCacheEntry, p: Patient, id: BriefSectionId, now: Date) {
  const t = nowMs();
  briefStats.sectionComputes[id]++;
  entry.sections[id] = { id, bullets: COMPUTE[id](p, entry.role, now).slice(0, BRIEF_SECTION_CAP), computedAt: now.toISOString() };
  devLog(`section ${id} (${p.id}, ${entry.role})`, nowMs() - t);
}
function fingerprints(p: Patient, role: StaffRole, now: Date) {
  briefStats.fingerprintPasses++;
  const fp: Partial<Record<BriefSource, string>> = {};
  for (const s of ALL_SOURCES) fp[s] = sourceFingerprint(s, p, role, now);
  return fp;
}
function changedSections(entry: BriefCacheEntry, fp: Partial<Record<BriefSource, string>>): BriefSectionId[] {
  const out = new Set<BriefSectionId>();
  for (const s of ALL_SOURCES) if (entry.fingerprint[s] !== fp[s]) for (const sec of SOURCE_TO_SECTIONS[s]) out.add(sec);
  for (const { id } of BRIEF_SECTIONS) if (!entry.sections[id]) out.add(id);
  return BRIEF_SECTIONS.map((x) => x.id).filter((id) => out.has(id));
}

/**
 * Synchronous, incremental: validates the entry against the store and
 * recomputes ONLY sections whose sources changed. A hit (store unchanged
 * since last validation) touches no record data.
 */
export function getAdelBrief(p: Patient, role: StaffRole, now = new Date()): BriefCacheEntry {
  ensureSubscribed();
  const t = nowMs();
  const key = keyOf(p, role);
  let entry = cache.get(key);
  if (entry && entry.version === storeVersion && entry.refreshing.size === 0 && entry.fingerprint.day === ymd(now)) {
    briefStats.hits++;
    devLog(`hit (${p.id}, ${role})`, nowMs() - t);
    return entry;
  }
  if (!entry) {
    entry = { key, patientId: p.id, role, version: -1, fingerprint: {}, sections: {}, refreshing: new Set() };
    cache.set(key, entry);
    briefStats.fullComputes++;
  }
  const fp = fingerprints(p, role, now);
  for (const id of changedSections(entry, fp)) computeSection(entry, p, id, now);
  entry.fingerprint = fp;
  entry.version = storeVersion;
  entry.refreshing.clear();
  entry.computedAsOf = now.toISOString();
  devLog(`validate (${p.id}, ${role})`, nowMs() - t);
  return entry;
}

/**
 * Non-blocking read for the UI: returns whatever is cached (even if stale)
 * and schedules an idle-time incremental refresh. Only a cold miss computes
 * synchronously.
 */
export function peekAdelBrief(p: Patient, role: StaffRole): BriefCacheEntry {
  ensureSubscribed();
  const entry = cache.get(keyOf(p, role));
  if (!entry) return getAdelBrief(p, role);
  briefStats.hits++;
  if (entry.version !== storeVersion || entry.fingerprint.day !== ymd(new Date())) queueRefresh(entry.key);
  return entry;
}

export function getBriefActions(p: Patient, role: StaffRole, staffId: string, now = new Date()): BriefAction[] {
  const key = `${keyOf(p, role)}|${staffId}`;
  const fp = ACTION_DEPS.map((s) => sourceFingerprint(s, p, role, now)).join("~");
  const hit = actionCache.get(key);
  if (hit && hit.fp === fp) return hit.actions;
  const actions = computeBriefActions(p, role, staffId, now);
  actionCache.set(key, { fp, actions });
  return actions;
}

/** "new" = the bullet's data is newer than this viewer's last view of the Brief. */
export function isBulletNew(b: BriefBullet, lastSeen: string | undefined): boolean {
  return !!lastSeen && b.at > lastSeen;
}
export function briefBulletsFlat(entry: BriefCacheEntry): BriefBullet[] {
  return BRIEF_SECTIONS.flatMap(({ id }) => entry.sections[id]?.bullets ?? []);
}
export { briefLastSeen };

// ---------------------------------------------------------------- background scheduling
type IdleFn = (cb: () => void) => void;
const idle: IdleFn = (cb) => {
  const w = typeof window !== "undefined" ? (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }) : undefined;
  if (w?.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 500 });
  else setTimeout(cb, 1);
};
const queue: string[] = [];
let pumping = false;
function queueRefresh(key: string) {
  if (!queue.includes(key)) queue.push(key);
  pump();
}
function pump() {
  if (pumping || !queue.length) return;
  pumping = true;
  idle(() => {
    pumping = false;
    const key = queue.shift();
    const entry = key ? cache.get(key) : undefined;
    const p = entry ? AdelanteEHR.getPatient(entry.patientId) : undefined;
    if (entry && p) refreshEntryStepwise(entry, p);
    pump();
  });
}
/** Mark changed sections "Refreshing…", then recompute each in its own idle slice. */
function refreshEntryStepwise(entry: BriefCacheEntry, p: Patient) {
  const now = new Date();
  const fp = fingerprints(p, entry.role, now);
  const todo = changedSections(entry, fp);
  const version = storeVersion;
  if (!todo.length) {
    entry.fingerprint = fp;
    entry.version = version;
    return;
  }
  for (const id of todo) entry.refreshing.add(id);
  notify();
  const step = () => {
    const id = todo.shift();
    if (!id) {
      entry.fingerprint = fp;
      entry.version = version;
      entry.computedAsOf = now.toISOString();
      notify();
      return;
    }
    computeSection(entry, p, id, now);
    entry.refreshing.delete(id);
    notify();
    idle(step);
  };
  idle(step);
}
function scheduleBackgroundRefresh() {
  // Only entries someone has already looked at or warmed (bounded).
  for (const k of [...cache.keys()].slice(-40)) queueRefresh(k);
}

/** Warm the cache for a viewer's day without blocking first render. */
export function warmAdelBriefs(patientIds: string[], role: StaffRole): void {
  ensureSubscribed();
  const ids = [...new Set(patientIds)].slice(0, 30);
  const next = () => {
    const id = ids.shift();
    if (!id) return;
    const p = AdelanteEHR.getPatient(id);
    if (p && !cache.has(keyOf(p, role))) {
      const t = nowMs();
      getAdelBrief(p, role);
      devLog(`warm (${id}, ${role})`, nowMs() - t);
      notify();
    }
    idle(next);
  };
  idle(next);
}
/** Today's scheduled patients + caseload for the workspace person. */
export function workspaceBriefTargets(staffId: string, clinicianId: string | undefined, now = new Date()): string[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = +start + DAY;
  const today = AdelanteEHR.listAppointments().filter((a) => (!clinicianId || a.clinicianId === clinicianId) && +new Date(a.start) >= +start && +new Date(a.start) < end).map((a) => a.patientId);
  const caseload = AdelanteEHR.listPatients().filter((p) => p.caseManagerId === staffId || (!!clinicianId && p.primaryClinicianId === clinicianId) || p.prescriberStaffId === staffId).map((p) => p.id);
  return clinicianId || today.length ? [...today, ...caseload] : caseload;
}

export function _resetAdelBriefCache() {
  cache.clear();
  actionCache.clear();
  queue.length = 0;
  _resetBriefStats();
}
export const _briefCacheKeys = () => [...cache.keys()];

// ---------------------------------------------------------------- A4 Simulated narrative
/**
 * "Adel summary (Simulated)": 2–3 sentences built by the Simulated LLM adapter
 * from THIS viewer's cached bullets only (already Part 2-filtered), each with
 * the bullet ids it came from. Audits `simulated: true`, never any content.
 */
export function adelSummary(entry: BriefCacheEntry, actor: { staffId: string; role: string }): LlmSentence[] {
  const titles = Object.fromEntries(BRIEF_SECTIONS.map((s) => [s.id, s.title]));
  const bullets = BRIEF_SECTIONS.flatMap(({ id }) => (entry.sections[id]?.bullets ?? []).map((b) => ({ id: `${id}:${b.id}`, text: b.text, sectionTitle: titles[id] })));
  const out = SimulatedLlmAdapter.summarizeBrief(bullets);
  AdelanteEHR._recordAudit({
    category: "adel_brief",
    action: "adel_summary_generated",
    patientId: entry.patientId,
    actorId: actor.staffId,
    actorRole: actor.role,
    detail: { simulated: true, sentences: out.length, sourceCount: bullets.length },
  });
  return out;
}
