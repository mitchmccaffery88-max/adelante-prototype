// ONE substance-use (SUD) signal for a patient. Used by the care-plan flag
// sweep (`detectFlags`) and by content audiences (`personAudiences`), so the
// two can never disagree. Draft — pending clinical sign-off.
//
// A positive AUDIT / DAST screener does NOT set this signal: it only creates a
// staff task to consider the Recovery Journey (`requestRecoveryJourneyReview`).
//
// No runtime imports on purpose: the patient store's import graph reaches this
// module, so the episode and care-plan sources register themselves here from
// their own modules (outpatientCare.ts, structuredCarePlan.ts) instead.
import type { Patient } from "./ehr";

const SUD_ICD = /^F1[0-9]/i;

type Source = (patientId: string) => boolean;
const sources: { openSudEpisode?: Source; sudCarePlanGoal?: Source } = {};
export function registerSudSignalSource(kind: keyof typeof sources, fn: Source) {
  sources[kind] = fn;
}
const safe = (fn: Source | undefined, id: string) => {
  try {
    return fn ? fn(id) : false;
  } catch {
    return false;
  }
};

/** Why the SUD signal is on (audit-reason wording), or undefined when it is off. */
export function sudSignalReason(p: Patient): string | undefined {
  const sudProblem = (p.problems ?? []).some(
    (x) => x.status === "active" && (x.category === "sud" || SUD_ICD.test(x.icd10Code ?? "")),
  );
  if (sudProblem) return "SUD diagnosis on the problem list";
  const sudEpisode = p.episodes?.some((e) => e.type === "sud_dmc_ods") || safe(sources.openSudEpisode, p.id);
  if (sudEpisode) return "episode set to an SUD program";
  if (p.needs?.substanceUse)
    return p.flagSources?.sud ?? (p.referralId ? "SUD indicator at referral" : "SUD indicator at intake");
  // Draft — pending clinical sign-off: a clinician's substance-use goal on the care plan.
  if (safe(sources.sudCarePlanGoal, p.id)) return "substance-use goal on the care plan";
  return undefined;
}
