// Single rule: is this person justice-involved? Release-date questions, the
// reentry window, reentry suggestions and "My First Days Out" all read this.
import type { TriState } from "./frontDoor";
import type { Patient } from "./ehr";

/** Intake answer. "prefer_not" is treated as not justice-involved. */
export type JusticeAnswer = TriState | "prefer_not";

export function isJusticeInvolved(p: Patient | undefined | null): boolean {
  if (!p) return false;
  if (p.coverage?.justiceInvolvement === "yes") return true;
  if (p.custody || p.coverage?.jiReentryFlag || p.missedPreReleaseCoordination) return true;
  return (p.problems ?? []).some((x) => x.status === "active" && x.icd10Code === "Z65.2");
}
