// V1 — Adel Brief consistency checker. For every bullet, resolve each source
// record (through the SAME role-filtered chart views the linked section uses),
// rebuild the bullet's numbers / dates / labels from those records alone, and
// independently recount the full set from the chart so a bullet can't silently
// drop records. Also fails on: no source, wrong chip, a source the role can't
// see, SUD detail for non-Part 2 roles, and any note-body text.
// Used by the unit test and exposed dev-only on window.__adelante.checkBrief.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { canAccess, isPrescriberRole, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection, filterSudMedsForRole } from "@/lib/asamReporting";
import { buildTrackingRows } from "@/lib/trackingTimeline";
import { hieChartView } from "@/lib/hie";
import { listLabOrders, listScreenerRequests, screenerRequestStatus, labTest } from "@/lib/chartOrders";
import { getStructuredPlan, planNeeds, planReviewDue, staffPlanView } from "@/lib/structuredCarePlan";
import { getSafetyPlan } from "@/lib/safetyPlan";
import { listHlocReferrals } from "@/lib/outpatientCare";
import { isReferralOpen } from "@/lib/noteAutofill";
import { isMatOrder, listSelfReports } from "@/lib/medAdherence";
import { moodCheckInDayCount } from "@/lib/moodCheckInCount";
import { computeCheckInStreak } from "@/lib/checkInStreak";
import { aiConsentStatus } from "@/lib/scribe";
import { reentryDay } from "@/lib/chartBrief";
import {
  BRIEF_SECTIONS, _briefFmt, getAdelBrief, type BriefBullet, type BriefSectionId, type BriefSourceKind, type BriefSourceRef,
} from "@/lib/adelBrief";

const DAY = 86400000;
const { md, plural } = _briefFmt;
export const SUD_TEXT = /substance|opioid|alcohol|asam|\bsud\b|drug screen|buprenorph|suboxone|methadone|naltrex|vivitrol|\baudit\b|dast|\bMAT\b|part 2|naloxone|narcan|uds\b/i;

export interface BriefIssue {
  patientId: string;
  role: StaffRole;
  section: BriefSectionId;
  bulletId: string;
  problem: "no_source" | "unresolved_source" | "wrong_chip" | "mismatch" | "sud_leak" | "note_body_leak" | "incomplete";
  detail: string;
}

/** Chip each source kind must link to. */
const CHIP: Record<BriefSourceKind, string[]> = {
  order: ["medications"], dose_report: ["medications"], refill_request: ["medications"],
  screener_request: ["tracking"], screening: ["tracking"], lab_order: ["tracking"], checkin_day: ["tracking"],
  appointment: ["appointments"], message: ["messages"], patient_release: ["demographics"],
  hie_encounter: ["outside-records"], goal: ["care-plan"], care_plan: ["care-plan"], sdoh_need: ["care-plan"],
  safety_plan: ["safety-plan"], progress_note: ["notes"], hloc_referral: ["episodes"], resource_referral: ["episodes"], consent: ["consents"],
};

const seesVisits = (r: StaffRole, p: Patient) => canAccess(r, "case_notes", p).level !== "none";
const meds = (p: Patient, r: StaffRole) =>
  canAccess(r, "meds_erx", p).level === "none" ? [] : filterSudMedsForRole((p.orders ?? []).filter((o) => o.status === "signed"), r, p).visible;
const completed = (p: Patient, r: StaffRole, key: string) =>
  buildTrackingRows(p, r).filter((x) => x.key === key && x.status === "completed" && x.score !== undefined).sort((a, b) => a.date.localeCompare(b.date));
const visibleRefills = (p: Patient, r: StaffRole) => {
  const m = meds(p, r);
  const ids = new Set(m.map((o) => o.id)), names = new Set(m.map((o) => o.drugName.toLowerCase()));
  return AdelanteEHR.listRefillRequests({ patientId: p.id, status: "pending" }).filter((x) => ids.has(x.medicationId) || names.has(x.medicationName.toLowerCase()));
};
const pastAppts = (p: Patient, now: Date) => AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id && +new Date(a.start) <= +now);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Resolve one source through the role-filtered chart view. undefined = not visible / not found. */
function resolve(ref: BriefSourceRef, p: Patient, role: StaffRole, now: Date): unknown {
  const { id } = ref;
  switch (ref.kind) {
    case "order": return meds(p, role).find((o) => o.id === id);
    case "dose_report": {
      const ok = new Set(meds(p, role).map((o) => o.id));
      return listSelfReports(p.id).find((s) => `${s.orderId}@${s.scheduledAt}` === id && ok.has(s.orderId));
    }
    case "screener_request": return listScreenerRequests(p.id, role).find((r) => r.id === id);
    case "screening": {
      const [key, date] = [id.slice(0, id.indexOf("@")), id.slice(id.indexOf("@") + 1)];
      return buildTrackingRows(p, role).find((r) => r.key === key && r.date === date && r.status === "completed");
    }
    case "appointment": return seesVisits(role, p) ? AdelanteEHR.listAppointments().find((a) => a.id === id && a.patientId === p.id) : undefined;
    case "message": return seesVisits(role, p) ? AdelanteEHR.listCareMessages(p.id).find((m) => m.id === id) : undefined;
    case "patient_release": return id === p.id && reentryDay(p, now) ? p : undefined;
    case "checkin_day": return moodCheckInDayCount(p.id, id, id) > 0 ? id : undefined;
    case "refill_request": return visibleRefills(p, role).find((r) => r.id === id);
    case "lab_order": return listLabOrders(p.id, role).find((o) => o.id === id);
    case "hie_encounter": return hieChartView(p.id, role).encounters.find((e) => e.id === id);
    case "goal": return canAccess(role, "care_plan", p).level === "none" ? undefined : staffPlanView(p.id, role).goals.find((g) => g.id === id);
    case "care_plan": return id === p.id && canAccess(role, "care_plan", p).level !== "none" ? getStructuredPlan(p.id) : undefined;
    case "safety_plan": return id === p.id && canAccess(role, "safety_plan", p).level !== "none" ? getSafetyPlan(p.id) : undefined;
    case "sdoh_need": return canAccess(role, "sdoh", p).level === "none" ? undefined : planNeeds(p.id).find((n) => n.id === id);
    case "progress_note": return seesVisits(role, p) ? (p.progressNotes ?? []).find((n) => n.id === id) : undefined;
    case "hloc_referral": return listHlocReferrals(p.id).find((r) => r.id === id && (roleSeesAsamSection(role, p) || !r.sudRelated));
    case "resource_referral": return canAccess(role, "sdoh", p).level === "none" ? undefined : (p.resourceReferrals ?? []).find((r) => r.id === id);
    case "consent":
      if (canAccess(role, "demographics", p).level === "none") return undefined;
      if (id === "part2") return roleSeesAsamSection(role, p) ? { id } : undefined;
      return id === "ai_recording" ? { id } : undefined;
  }
}

type Res = { expected: string; completeIds?: string[] } | { error: string };

/** Rebuild the bullet text from its resolved records + an independent full recount. */
function rebuild(b: BriefBullet, recs: unknown[], p: Patient, role: StaffRole, now: Date): Res {
  const ids = (b.sources ?? []).map((s) => s.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const R = recs as any[];
  if (b.id.startsWith("run-") || b.id.startsWith("mat-")) {
    const o = R[0];
    const end = new Date(new Date(`${o.startDate}T00:00:00`).getTime() + o.daysSupply * DAY);
    const left = Math.ceil((+end - +now) / DAY);
    const out = end.toISOString().slice(0, 10);
    if (b.id.startsWith("mat-")) {
      if (!isMatOrder(o) || left > 0) return { error: "MAT gap claimed but supply not out" };
      return { expected: `MAT continuity gap — ${o.drugName} supply ran out ${md(out)}.` };
    }
    if (left > 7) return { error: "runway bullet for a medication with >7 days left" };
    return { expected: left <= 0 ? `${o.drugName} supply ran out ${md(out)}.` : `${o.drugName} runs out in ${plural(left, "day")}.` };
  }
  if (b.id === "missed") {
    const ok = new Set(meds(p, role).map((o) => o.id));
    const all = listSelfReports(p.id).filter((s) => ok.has(s.orderId) && s.status === "not_taken" && +now - +new Date(s.scheduledAt) <= 14 * DAY && +new Date(s.scheduledAt) <= +now);
    if (R.some((s) => s.status !== "not_taken")) return { error: "source dose was not missed" };
    return { expected: `${plural(R.length, "missed dose")} self-reported in the last 14 days.`, completeIds: all.map((s) => `${s.orderId}@${s.scheduledAt}`) };
  }
  if (b.id === "rescreen-overdue") {
    if (R.some((r) => screenerRequestStatus(r, now) !== "overdue")) return { error: "re-screen not overdue" };
    const all = listScreenerRequests(p.id, role).filter((r) => screenerRequestStatus(r, now) === "overdue");
    return { expected: `Overdue re-screen: ${R.map((r) => r.key.toUpperCase()).join(", ")}.`, completeIds: all.map((r) => r.id) };
  }
  if (b.id === "visits") {
    const all = pastAppts(p, now).filter((a) => +now - +new Date(a.start) <= 60 * DAY);
    const in30 = R.filter((a) => +now - +new Date(a.start) <= 30 * DAY);
    const c = (xs: typeof R, s: string) => xs.filter((a) => a.status === s).length;
    return { expected: `Visits: ${c(in30, "attended")} attended / ${c(in30, "no_show")} missed (30 d); ${c(R, "attended")} / ${c(R, "no_show")} (60 d).`, completeIds: all.map((a) => a.id) };
  }
  if (b.id === "reentry") return { expected: `Reentry day ${reentryDay(p, now)}.` };
  if (b.id === "contact") {
    const r = R[0];
    const at: string = r.createdAt ?? r.start;
    if (r.start && r.status !== "attended") return { error: "last contact visit was not attended" };
    // must be the latest attended visit / staff message
    const latest = [
      ...pastAppts(p, now).filter((a) => a.status === "attended").map((a) => a.start),
      ...AdelanteEHR.listCareMessages(p.id).filter((m) => m.authorType === "staff").map((m) => m.createdAt),
    ].sort().at(-1);
    if (latest !== at) return { error: `contact source ${at} is not the latest contact ${latest}` };
    return { expected: `${plural(Math.max(0, Math.floor((+now - +new Date(at)) / DAY)), "day")} since last contact.` };
  }
  if (b.id === "checkins") {
    const all: string[] = [];
    for (let i = 0; i < 30; i++) { const d = ymd(new Date(+now - i * DAY)); if (moodCheckInDayCount(p.id, d, d) > 0) all.push(d); }
    const n = computeCheckInStreak(ids, ymd(now)).days;
    return { expected: `Check-ins: ${plural(ids.length, "day")} in last 30${n ? `; ${n}-day streak` : ""}.`, completeIds: all };
  }
  if (b.id === "msgs") {
    if (R.some((m) => m.authorType !== "patient")) return { error: "message not from patient" };
    const all = AdelanteEHR.listCareMessages(p.id).filter((m) => m.authorType === "patient" && +now - +new Date(m.createdAt) <= 30 * DAY);
    return { expected: `${plural(R.length, "message")} from the patient in the last 30 days.`, completeIds: all.map((m) => m.id) };
  }
  if (b.id.startsWith("m-")) {
    const key = b.id.slice(2);
    const s = completed(p, role, key);
    const want = s.length >= 2 ? [s.at(-2)!, s.at(-1)!] : s.slice(-1);
    if (want.map((x) => `${key}@${x.date}`).join() !== ids.join()) return { error: "not the two latest scores in tracking history" };
    const label = key.toUpperCase();
    if (R.length === 1) return { expected: `${label} ${R[0].score} — first score on file.` };
    const d = R[1].score - R[0].score;
    return { expected: `${label} ${R[0].score} → ${R[1].score} (${d > 0 ? "+" : ""}${d}, ${d < 0 ? "improving" : d > 0 ? "worsening" : "no change"}).` };
  }
  if (b.id === "refills") {
    if (!isPrescriberRole(role) && canAccess(role, "meds_erx", p).level === "none") return { error: "role has no medication access" };
    return { expected: `Open refill request: ${R.map((r) => r.medicationName).join(", ")}.`, completeIds: visibleRefills(p, role).map((r) => r.id) };
  }
  if (b.id === "labs") {
    if (R.some((o) => o.status !== "pending")) return { error: "lab not pending" };
    return { expected: `Pending result: ${R.map((o) => labTest(o.testId)?.label ?? "lab").join(", ")}.`, completeIds: listLabOrders(p.id, role).filter((o) => o.status === "pending").map((o) => o.id) };
  }
  if (b.id === "hie") {
    const e = R[0];
    if (+now - +new Date(e.at) > 30 * DAY) return { error: "outside event older than 30 days" };
    return { expected: `Outside event: ${e.kind.replace(/_/g, " ")} at ${e.facility} (HIE).` };
  }
  if (b.id.startsWith("goal-")) {
    if (R.some((g) => g.status !== "active")) return { error: "goal not active" };
    const all = staffPlanView(p.id, role).goals.filter((g) => g.status === "active");
    return { expected: `Check progress on goal: ${R[0].clinicalText}${R.length > 1 ? ` (+${R.length - 1} more)` : ""}.`, completeIds: all.map((g) => g.id) };
  }
  if (b.id === "phq-due") {
    const last = completed(p, role, "phq-9").at(-1);
    if (!last || `phq-9@${last.date}` !== ids[0] || +now - +new Date(last.date) <= 30 * DAY) return { error: "PHQ-9 not actually due" };
    return { expected: `PHQ-9 re-screen due (last ${md(last.date)}).` };
  }
  if (b.id === "plan-review") {
    if (!planReviewDue(p.id, now)) return { error: "care-plan review not due" };
    return { expected: `Care-plan review due ${md(R[0].review.reviewDueAt)}.` };
  }
  if (b.id === "safety-review") {
    const last = R[0]?.lastReviewedAt ?? R[0]?.updatedAt;
    if (!last || +now - +new Date(last) <= 90 * DAY) return { error: "safety plan review not due" };
    return { expected: `Safety plan review due (last ${md(last)}).` };
  }
  if (b.id === "sdoh") {
    if (R.some((n) => n.step === "Completed")) return { error: "social need is closed" };
    return { expected: `${plural(R.length, "open social need")}.`, completeIds: planNeeds(p.id).filter((n) => n.step !== "Completed").map((n) => n.id) };
  }
  if (b.id === "unsigned") {
    if (R.some((n) => n.status === "signed" || n.signedAt)) return { error: "note is signed" };
    return { expected: `${plural(R.length, "unsigned note")}.`, completeIds: (p.progressNotes ?? []).filter((n) => n.status !== "signed" && !n.signedAt).map((n) => n.id) };
  }
  if (b.id === "referrals") {
    const sees = roleSeesAsamSection(role, p);
    const hloc = listHlocReferrals(p.id).filter((r) => !["declined", "closed", "admitted"].includes(r.status) && (sees || !r.sudRelated));
    const res = canAccess(role, "sdoh", p).level !== "none" ? (p.resourceReferrals ?? []).filter((r) => isReferralOpen(r)) : [];
    for (const s of b.sources ?? []) {
      const ok = s.kind === "hloc_referral" ? hloc.some((r) => r.id === s.id) : res.some((r) => r.id === s.id);
      if (!ok) return { error: `referral ${s.id} is not open` };
    }
    return { expected: `${plural(R.length, "open referral")}.`, completeIds: [...hloc, ...res].map((r) => r.id) };
  }
  if (b.id === "consents") {
    for (const id of ids) {
      if (id === "ai_recording" && aiConsentStatus(p.id, now).state === "active") return { error: "AI recording consent is on file" };
      if (id === "part2" && AdelanteEHR.getConsentState(p.id).part2Sud) return { error: "Part 2 consent is on file" };
    }
    return { expected: `Consent not on file: ${ids.map((i) => (i === "part2" ? "Part 2" : "AI recording")).join(", ")}.` };
  }
  return { error: `no verifier for bullet type ${b.id}` };
}

function noteBodies(p: Patient): string[] {
  const out: string[] = [];
  for (const n of p.progressNotes ?? [])
    for (const k of ["subjective", "objective", "assessment", "plan", "data", "behavior", "intervention", "response", "body"] as const) {
      const v = (n as unknown as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim().length >= 15) out.push(v.trim().slice(0, 40));
    }
  return out;
}

/** Check one patient × role. Returns every issue (empty = consistent). */
export function checkBriefFor(p: Patient, role: StaffRole, now = new Date()): BriefIssue[] {
  const issues: BriefIssue[] = [];
  const entry = getAdelBrief(p, role, now);
  const sees = roleSeesAsamSection(role, p);
  const bodies = noteBodies(p);
  for (const { id: section } of BRIEF_SECTIONS) {
    for (const b of entry.sections[section]?.bullets ?? []) {
      const add = (problem: BriefIssue["problem"], detail: string) => issues.push({ patientId: p.id, role, section, bulletId: b.id, problem, detail });
      if (!sees && SUD_TEXT.test(b.text)) add("sud_leak", "SUD detail shown to a role failing the Part 2 check");
      if (bodies.some((x) => b.text.includes(x))) add("note_body_leak", "note body text in a bullet");
      const srcs = b.sources ?? [];
      if (!srcs.length) { add("no_source", "bullet has no source records"); continue; }
      if (srcs.some((s) => !CHIP[s.kind].includes(b.sectionId))) add("wrong_chip", `chip ${b.sectionId} vs ${srcs.map((s) => s.kind).join(",")}`);
      const recs = srcs.map((s) => resolve(s, p, role, now));
      const missing = srcs.filter((_, i) => recs[i] === undefined);
      if (missing.length) { add("unresolved_source", `not visible/not found: ${missing.map((m) => `${m.kind}:${m.id}`).join(", ")}`); continue; }
      const r = rebuild(b, recs, p, role, now);
      if ("error" in r) { add("mismatch", r.error); continue; }
      if (r.expected !== b.text) add("mismatch", `shows "${b.text}" but chart says "${r.expected}"`);
      if (r.completeIds) {
        const a = [...new Set(srcs.map((s) => s.id))].sort().join(), want = [...new Set(r.completeIds)].sort().join();
        if (a !== want) add("incomplete", `bullet sources [${a}] ≠ chart records [${want}]`);
      }
    }
  }
  return issues;
}

/** Walk every patient × role. Dev-only entry point: window.__adelante.checkBrief(). */
export function checkAllBriefs(roles: StaffRole[], now = new Date(), patients = AdelanteEHR.listPatients()): { checked: number; bullets: number; issues: BriefIssue[] } {
  const issues: BriefIssue[] = [];
  let bullets = 0;
  for (const p of patients)
    for (const role of roles) {
      const e = getAdelBrief(p, role, now);
      bullets += BRIEF_SECTIONS.reduce((n, s) => n + (e.sections[s.id]?.bullets.length ?? 0), 0);
      issues.push(...checkBriefFor(p, role, now));
    }
  return { checked: patients.length * roles.length, bullets, issues };
}
