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
import { autoAddJourneyAssignment, getStructuredPlan, markFlagRemovedForReview, markPathwayChangedForReview, type SpecialtyFlag } from "./structuredCarePlan";
import { listEpisodes } from "./outpatientCare";
import { listContent } from "./contentPublishing";

export const FLAG_JOURNEY_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const NEW_CONTENT_NOTICE = { en: "New content was added to your plan", es: "Se agregó contenido nuevo a tu plan" } as const;
export const NEW_CONTENT_BODY = { en: "Open My journeys to see it.", es: "Abre Mis caminos para verlo. (Borrador de traducción)" } as const;
export const CONTENT_GAP_LABEL = "Content gap — no live journey matches a care-plan flag";

const SUD_ICD = /^F1[0-9]/i;

/** Why the flag is on, phrased as the audit reason's trigger. Reason always matches the rule (S5). */
export function detectFlags(p: Patient): Partial<Record<SpecialtyFlag, string>> {
  const out: Partial<Record<SpecialtyFlag, string>> = {};
  if (isJusticeInvolved(p)) {
    const z = (p.problems ?? []).some((x) => x.status === "active" && x.icd10Code === "Z65.2");
    out.justice_involved =
      p.flagSources?.justice_involved ??
      (p.coverage?.justiceInvolvement === "yes"
        ? p.referralId ? "justice-involved flag at referral" : "justice-involved answer at intake"
        : z ? "documented problem Z65.2"
        : p.custody ? "custody record"
        : p.coverage?.jiReentryFlag ? "reentry initiative answer at intake"
        : "missed pre-release coordination flag");
  }
  const sudProblem = (p.problems ?? []).some((x) => x.status === "active" && (x.category === "sud" || SUD_ICD.test(x.icd10Code ?? "")));
  const sudEpisode = p.episodes?.some((e) => e.type === "sud_dmc_ods") || safeEpisodes(p.id).some((e) => e.program === "outpatient_sud" && !e.closedAt);
  if (sudProblem) out.sud = "SUD diagnosis on the problem list";
  else if (sudEpisode) out.sud = "episode set to an SUD program";
  else if (p.needs?.substanceUse) out.sud = p.flagSources?.sud ?? (p.referralId ? "SUD indicator at referral" : "SUD indicator at intake");
  return out;
}

// ------------------------------------------------------------ pathway (P2)
/** §Group 2 P2 — one derived pathway per patient. Draft. `advocate` reserved, not built. */
export type Pathway = "general" | "reentry" | "sud" | "reentry_sud";
export function pathwayFromFlags(f: Partial<Record<SpecialtyFlag, string>>): Pathway {
  return f.justice_involved && f.sud ? "reentry_sud" : f.justice_involved ? "reentry" : f.sud ? "sud" : "general";
}
export function patientPathway(patientId: string): Pathway {
  const p = AdelanteEHR.getPatient(patientId);
  return p ? pathwayFromFlags(detectFlags(p)) : "general";
}
export const pathwayHasSud = (x: Pathway) => x === "sud" || x === "reentry_sud";
export const pathwayHasReentry = (x: Pathway) => x === "reentry" || x === "reentry_sud";
/** Staff chip text. Without Part 2 access the SUD half is never shown (hidden, not stubbed). */
export function pathwayChipLabel(x: Pathway, seesPart2: boolean): string | null {
  const r = pathwayHasReentry(x), s = pathwayHasSud(x) && seesPart2;
  return r && s ? "Re-entry + SUD" : r ? "Re-entry" : s ? "SUD" : null;
}
/** Bridge to the two older population vocabularies (kept working). */
export function pathwayToContentPopulation(x: Pathway): "justice_involved" | "general" {
  return pathwayHasReentry(x) ? "justice_involved" : "general";
}

function safeEpisodes(patientId: string) {
  try {
    return listEpisodes(patientId) as { program: string; closedAt?: string }[];
  } catch {
    return [];
  }
}

/** Live published journeys tagged for a flag (legacy tag). Never hard-coded lesson ids. */
export function journeysForFlag(flag: SpecialtyFlag): Curriculum[] {
  return liveCurricula().filter((j) => ((j.meta as { flags?: string[] } | undefined)?.flags ?? []).includes(flag));
}
/**
 * §Group 2 P5 — interim rule (Draft, pending Cathy's review): live journeys
 * tagged `meta.pathways` for this pathway, in `meta.pathwayOrder` order.
 */
export function journeysForPathway(x: Pathway): Curriculum[] {
  type M = { pathways?: string[]; pathwayOrder?: number } | undefined;
  return liveCurricula()
    .filter((j) => ((j.meta as M)?.pathways ?? []).includes(x))
    .sort((a, b) => ((a.meta as M)?.pathwayOrder ?? 99) - ((b.meta as M)?.pathwayOrder ?? 99));
}

// ------------------------------------------------------------ content gaps
export interface ContentGapItem { id: string; flag: SpecialtyFlag; at: string; patients: number; closedAt?: string; owner?: string }
/** Content owner pool (Draft): content_authoring write roles that own content — sys_admin only stands in when no author owns it. */
export const CONTENT_POOL_ROLES = ["sys_admin"] as const;
const gaps: ContentGapItem[] = [];
export const listContentGaps = () => gaps.filter((g) => !g.closedAt).map((g) => ({ ...g }));
/** §Group 2 G1 — the content owner: the owner of the matching category, else the owner pool. */
export const CONTENT_OWNER_POOL_ROLE = "content_owner_pool";
/** Default: owner of any journey (draft or retired) tagged for this flag/pathway; content_authoring owns journeys. */
function defaultGapOwner(flag: SpecialtyFlag): string | undefined {
  const pw = flag === "sud" ? ["sud", "reentry_sud"] : ["reentry", "reentry_sud"];
  for (const e of listContent("journey")) {
    const m = (e.body as { meta?: { owner?: string; flags?: string[]; pathways?: string[] } }).meta;
    if (m?.owner && ((m.flags ?? []).includes(flag) || (m.pathways ?? []).some((x) => pw.includes(x)))) return m.owner;
  }
  return undefined;
}
let gapOwnerResolver: ((flag: SpecialtyFlag) => string | undefined) | undefined = defaultGapOwner;
export function setContentGapOwnerResolver(fn: typeof gapOwnerResolver) { gapOwnerResolver = fn; }
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
  const owner = gapOwnerResolver?.(flag);
  const note = { category: "patient_update" as const, subject: "New task: Content gap", body: "A care-plan flag has no live journey yet. Open Needs my action.", linkRoute: "/admin-content", dedupeKey: `content-gap:${g.id}`, kind: "task" as const, taskKey: `content-gap:${g.id}` };
  g.owner = owner ?? "Content owner pool";
  if (owner) AdelanteEHR.notify({ ...note, recipientStaffId: owner });
  else for (const role of CONTENT_POOL_ROLES) AdelanteEHR.notify({ ...note, recipientRole: role });
}
/** Closes a gap once a matching journey is live. */
function closeGapsIfMatched(at: string) {
  for (const g of gaps) if (!g.closedAt && (journeysForFlag(g.flag).length || journeysForPathway(g.flag === "sud" ? "sud" : "reentry").length)) g.closedAt = at;
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
  const pathway = pathwayFromFlags(flags);
  const matches = journeysForPathway(pathway);
  if (pathway !== "general" && !matches.length) {
    for (const flag of now) if (!before.has(flag)) raiseGap(flag, at);
  }
  for (const j of matches) {
    const part2 = j.part2Sensitive === true || (j.meta as { part2?: boolean } | undefined)?.part2 === true;
    const flag: SpecialtyFlag = part2 && flags.sud ? "sud" : flags.justice_involved ? "justice_involved" : "sud";
    const trigger = flags[flag] ?? flags.sud ?? flags.justice_involved!;
    const a = autoAddJourneyAssignment({ patientId, journeyId: j.id, label: { en: j.title, es: j.es?.title ?? j.title }, flag, trigger: `Added automatically: ${trigger}`, part2, at });
    if (a) added.push(j.id);
  }
  for (const flag of before) if (!now.has(flag)) markFlagRemovedForReview(patientId, flag, at);
  // Pathway changed (rule or flags): items that no longer match are marked, never removed.
  const removedFlags = [...before].filter((f) => !now.has(f));
  markPathwayChangedForReview(patientId, matches.map((j) => j.id), removedFlags, at);
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
