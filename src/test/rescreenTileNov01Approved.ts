import { createHash } from "node:crypto";
import fixture from "./rescreenTileNov01.fixture.json";
// Mitch, 31 Oct 16:36 CT (R53 part 2, started 1 Nov). Clinician "Re-screens due"
// tile: screener rows leave Needs my action for clinician roles, caseload badges
// keep them, other roles get the same row detail, Tracking opens at the chip's
// instrument. Draft — pending clinical sign-off.
export function withApprovedRescreenTileNov01(path: string, source: string): string {
  const approval = fixture[path as keyof typeof fixture];
  if (!approval) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== approval.priorHash) throw new Error(`R53 tile prior source changed: ${path}`);
  let result = source;
  for (const [anchor, replacement] of approval.edits) {
    if (result.split(anchor).length !== 2) throw new Error(`R53 tile anchor not exactly once: ${path}`);
    result = result.replace(anchor, () => replacement);
  }
  if (hash(result) !== approval.updatedHash) throw new Error(`R53 tile replacement changed: ${path}`);
  return result;
}
