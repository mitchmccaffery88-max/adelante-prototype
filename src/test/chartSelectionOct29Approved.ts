import { createHash } from "node:crypto";
// Mitch approved exact-once gate-related source pin; all other bindings remain pinned.
export function withApprovedChartSelectionOct29(path: string, source: string): string {
  if (path !== "src/routes/clinician.tsx") return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== "b1335eaa0d610158f684b11d87907f247745b63886c41fd3d1843d04ce085458") throw new Error("Chart-selection prior source changed");
  const from = "selectedPatient = useEhr(() => AdelanteEHR.getPatient(selectedPatientId))";
  if (source.split(from).length !== 2) throw new Error("Chart-selection anchor not exactly once");
  const updated = source.replace(from, "selectedPatient = useEhr(() => chartEntryFor(acting.role, acting.staffId, selectedPatientId).ok\n    ? AdelanteEHR.getPatient(selectedPatientId) : undefined)");
  if (digest(updated) !== "a6cf11e23f9e080a01915b58cfe35a65c423b2d4e75e1bc2b9747352dfd21c09") throw new Error("Chart-selection replacement changed");
  return updated;
}
