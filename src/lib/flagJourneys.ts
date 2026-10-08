// §Group 1 C2 — flag-driven journeys (Mitch, 8 Oct: "one less administrative
// step for everyone"). Draft — pending clinical sign-off.
//
// When a patient's justice-involved or SUD flag is RECORDED (any store write —
// referral, intake answer, problem list, SUD program episode), the journeys
// tagged for that flag (published content, `meta.flags`) are added to the
// care plan automatically. Event-driven: this module subscribes to the EHR
// store and diffs each patient's flags, so it fires when the flag lands, not
// on read. Idempotent per journey. A removed flag never deletes anything; it
// marks the item "Flag removed — review". No published match → one
// content-gap item for the content owner pool. Patient notification text is
// neutral (no SUD words in bell, push or SMS).
import { AdelanteEHR, type Patient } from "./ehr";
import { isJusticeInvolved } from "./justiceInvolvement";
import { liveCurricula, type Curriculum } from "./curriculumTypes";
import { autoAddJourneyAssignment, getStructuredPlan, markFlagRemovedForReview, type SpecialtyFlag } from "./structuredCarePlan";
import { listEpisodes } from "./outpatientCare";

export const FLAG_JOURNEY_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const NEW_CONTENT_NOTICE = { en: "New content was added to your plan", es: "Se agregó contenido nuevo a tu plan" } as const;
export const NEW_CONTENT_BODY = { en: "Open My journeys to see it.", es: "Abre Mis caminos para verlo. (Borrador de traducción)" } as const;
export const CONTENT_GAP_LABEL = "Content gap — no live journey matches a care-plan flag";

const SUD_ICD = /^F1[0-9]/i;

/** Why the flag is on, phrased as the audit reason's trigger. */
export function detectFlags(p: Patient): Partial<Record<SpecialtyFlag, string>> {
  const out: Partial<Record<SpecialtyFlag, string>> = {};
  if (isJusticeInvolved(p)) {
    const z = (p.problems ?? []).some((x) => x.status === "active" && x.icd10Code === "Z65.2");
    const src = p.coverage?.justiceInvolvement === "yes" ? (p.referralId ? "justice-involved flag at referral" : "justice-involved answer at intake") : z ? "documented problem Z65.2" : "release date recorded";
    out.justice_involved = src;
  }
  const sudProblem = (p.problems ?? []).some((x) => x.status === "active" && (x.category === "sud" || SUD_ICD.test(x.icd10Code ?? "")));
  const sudEpisode = p.episodes?.some((e) => e.type === "sud_dmc_ods") || safeEpisodes(p.id).some((e) => e.program === "outpatient_sud" && !e.closedAt);
  if (sudProblem) out.sud = "SUD diagnosis on the problem list";
  else if (sudEpisode) out.sud = "episode set to an SUD program";
  else if (p.needs?.substanceUse) out.sud = p.referralId ? "SUD indicator at referral" : "SUD indicator at intake";
  return out;
}
function safeEpisodes(patientId: string) {
  try {
    return listEpisodes(patientId) as { program: string; closedAt?: string }[];
  } catch {
    return [];
  }
}

/** Live published journeys tagged for a flag. Never hard-coded lesson ids. */
export function journeysForFlag(flag: SpecialtyFlag): Curriculum[] {
  return liveCurricula().filter((j) => ((j.meta as { flags?: string[] } | undefined)?.flags ?? []).includes(flag));
}

// ------------------------------------------------------------ content gaps
export interface ContentGapItem { id: string; flag: SpecialtyFlag; at: string; patients: number; closedAt?: string }
const gaps: ContentGapItem[] = [];
export const listContentGaps = () => gaps.filter((g) => !g.closedAt).map((g) => ({ ...g }));
function raiseGap(flag: SpecialtyFlag, at: string) {
  const open = gaps.find((g) => g.flag === flag && !g.closedAt);
  if (open) {
    open.patients += 1;
    return;
  }
  const g: ContentGapItem = { id: `gap-${flag}-${gaps.length + 1}`, flag, at, patients: 1 };
  gaps.push(g);
  AdelanteEHR.recordActionEvent({ action: "content.gap_raised", actorRole: "system", detail: { gapId: g.id, reason: "No live journey matches a care-plan flag" } });
  // Content owner pool (Draft): the clinical coordinator. Neutral text.
  AdelanteEHR.notify({ recipientRole: "clinical_coordinator", category: "patient_update", subject: "New task: Content gap", body: "A care-plan flag has no live journey yet. Open Needs my action.", linkRoute: "/admin-content", dedupeKey: `content-gap:${g.id}`, kind: "task", taskKey: `content-gap:${g.id}` });
}
/** Closes a gap once a matching journey is live. */
function closeGapsIfMatched(at: string) {
  for (const g of gaps) if (!g.closedAt && journeysForFlag(g.flag).length) g.closedAt = at;
}

// ------------------------------------------------------------ the event handler
const lastFlags = new Map<string, Set<SpecialtyFlag>>();
let running = false;

/** Applies the flag → journey rule for one patient. Returns what was added. */
export function applyFlagJourneys(patientId: string, at = new Date().toISOString()): string[] {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return [];
  const flags = detectFlags(p);
  const now = new Set(Object.keys(flags) as SpecialtyFlag[]);
  const before = lastFlags.get(patientId) ?? new Set<SpecialtyFlag>();
  lastFlags.set(patientId, now);
  const added: string[] = [];
  for (const flag of now) {
    const trigger = flags[flag]!;
    const matches = journeysForFlag(flag);
    if (!matches.length) {
      if (!before.has(flag)) raiseGap(flag, at);
      continue;
    }
    for (const j of matches) {
      const a = autoAddJourneyAssignment({ patientId, journeyId: j.id, label: { en: j.title, es: j.es?.title ?? j.title }, flag, trigger: `Added automatically: ${trigger}`, part2: j.part2Sensitive === true || (j.meta as { part2?: boolean } | undefined)?.part2 === true, at });
      if (a) added.push(j.id);
    }
  }
  for (const flag of before) if (!now.has(flag)) markFlagRemovedForReview(patientId, flag, at);
  if (added.length) {
    const es = p.preferredLanguage === "es";
    AdelanteEHR.notifyMember({ audience: "patient", recipientId: patientId, patientId, subject: es ? NEW_CONTENT_NOTICE.es : NEW_CONTENT_NOTICE.en, body: es ? NEW_CONTENT_BODY.es : NEW_CONTENT_BODY.en, linkRoute: "/journeys", dedupeKey: `flag-journeys:${patientId}:${added.join(",")}` });
  }
  return added;
}

/** Runs the rule for every patient whose flags changed since last seen. */
export function sweepFlagJourneys(): void {
  if (running) return;
  running = true;
  try {
    const at = new Date().toISOString();
    closeGapsIfMatched(at);
    for (const p of AdelanteEHR.listPatients()) {
      const now = Object.keys(detectFlags(p)).sort().join(",");
      const before = [...(lastFlags.get(p.id) ?? [])].sort().join(",");
      if (lastFlags.has(p.id) && now === before) continue;
      applyFlagJourneys(p.id, at);
    }
  } finally {
    running = false;
  }
}

/** Journey ids auto-added to this patient's plan (patient sees their own journeys). */
export function autoAddedJourneyIds(patientId: string): string[] {
  try {
    return getStructuredPlan(patientId).assignments.filter((a) => a.active && a.autoAdded).map((a) => a.activityId!).filter(Boolean);
  } catch {
    return [];
  }
}

/** Test hook. */
export function _resetFlagJourneys(): void {
  lastFlags.clear();
  gaps.length = 0;
}

AdelanteEHR.subscribe(sweepFlagJourneys);
sweepFlagJourneys();
