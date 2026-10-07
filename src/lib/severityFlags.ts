// §C3 — re-screen severity flags: read views + the one review action.
// Flags are written by AdelanteEHR.recordScreener (rules: severityRules.ts).
// Visibility follows the chart's mental-health screener section
// (screeners_mh). Wording stays neutral: "Severity change" + instrument and
// numbers only — never item answers, never Part 2 content.
import { AdelanteEHR, type Patient } from "./ehr";
import { canAccess, type StaffRole } from "./roles";
import type { SeverityFlag } from "./severityRules";

export { SEVERITY_DRAFT_LABEL, SEVERITY_RULES } from "./severityRules";
export const SEVERITY_ROW_LABEL = "Severity change";

export const seesSeverity = (role: StaffRole, p: Patient) => canAccess(role, "screeners_mh", p).level !== "none";

/** Every flag + improving note the role may see (newest first). */
export function listSeverityFlags(p: Patient, role: StaffRole): SeverityFlag[] {
  if (!seesSeverity(role, p)) return [];
  return [...(p.severityFlags ?? [])].sort((a, b) => b.resultAt.localeCompare(a.resultAt));
}
/** Open (unreviewed) flags — the ones that create a Needs my action row. */
export function openSeverityFlags(p: Patient, role: StaffRole): SeverityFlag[] {
  return listSeverityFlags(p, role).filter((f) => f.kind === "flag" && !f.reviewedAt);
}
/** The clinician a flag routes to: primary clinician, else prescriber. */
export function severityAssignee(p: Patient): string | undefined {
  return p.primaryClinicianId ?? p.prescriberStaffId;
}
/** Clinical roles that may mark a flag reviewed (and only when they can see MH scores). Draft. */
export const SEVERITY_REVIEW_ROLES: readonly StaffRole[] = ["therapist", "pmhnp", "physician", "sud_counselor", "clinical_trainee", "nurse_rn"];
export function canReviewSeverity(role: StaffRole, p?: Patient): boolean {
  const a = canAccess(role, "screeners_mh", p);
  return SEVERITY_REVIEW_ROLES.includes(role) && a.level !== "none" && !a.locked;
}

/** Store function behind registry action `severity_flag_review`. */
export function reviewSeverityFlag(patientId: string, flagId: string, actor: { name: string; role: StaffRole; staffId?: string }): SeverityFlag {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) throw new Error("Patient not found.");
  if (!canReviewSeverity(actor.role, p)) throw new Error("Your role can't review score changes.");
  const f = (p.severityFlags ?? []).find((x) => x.id === flagId);
  if (!f || f.kind !== "flag") throw new Error("Flag not found.");
  if (f.reviewedAt) throw new Error("Already reviewed.");
  f.reviewedAt = new Date().toISOString();
  f.reviewedBy = actor.name;
  AdelanteEHR._recordAudit({ category: "clinical", action: "severity_flag_reviewed", patientId, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail: { flagId } });
  return f;
}
