import { createHash } from "node:crypto";
// Mitch approved 30 Oct 21:20 CT. Draft — pending clinical sign-off.
// Only the superseded optional-blank assertion changes; prior text is checked once.
const PATH = "src/lib/__tests__/reassessment.test.ts";
const APPROVED = {
  "prior": "5bd4dfe6fe407ad46e3aaf5e284f462ab2bb8cab8aa2b923b2eb2d32acf0b608",
  "updated": "098bfe539584038492da52711484ece20591035f866ee7c23c6a9bcc5aee1d95",
  "from": "    expect(() => AdelanteEHR.completeRescreen(p.id, \"phq-9\", [0, 1], { actorId: p.id, actorRole: \"patient\" })).toThrow();",
  "to": "    // Draft \u2014 pending clinical sign-off: optional blanks remain incomplete, never zero.\n    const historyBefore = (AdelanteEHR.getPatient(p.id)?.screenerHistory ?? []).length;\n    const result = AdelanteEHR.completeRescreen(p.id, \"phq-9\", [0, 1], { actorId: p.id, actorRole: \"patient\" });\n    expect(result).toMatchObject({ status: \"incomplete\", responses: [0, 1, null, null, null, null, null, null, null], skippedItems: [2, 3, 4, 5, 6, 7, 8] });\n    expect(result.score).toBeUndefined();\n    expect(AdelanteEHR.listIncompleteScreeners(p.id)).toContainEqual(result);\n    expect(AdelanteEHR.getPatient(p.id)?.screenerHistory?.length ?? 0).toBe(historyBefore);\n    expect(AdelanteEHR.caseTasksForPatient(p.id).some((task) => task.title === \"Screening follow-up needed\" && !task.completedAt)).toBe(true);"
};
export function withApprovedScreenerReassessmentOct30(path: string, source: string): string {
  if (path !== PATH) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== APPROVED.prior) throw new Error(`R5 reassessment prior source changed: ${path}`);
  if (source.split(APPROVED.from).length !== 2) throw new Error(`R5 reassessment anchor not exactly once: ${path}`);
  const updated = source.replace(APPROVED.from, () => APPROVED.to);
  if (hash(updated) !== APPROVED.updated) throw new Error(`R5 reassessment replacement changed: ${path}`);
  return updated;
}
