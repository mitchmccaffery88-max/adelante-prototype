import { createHash } from "node:crypto";
import fixture from "./rescreenCadenceOct31.fixture.json";
// Mitch, 31 Oct 16:36 CT. R53 part 1 only. Draft — pending clinical sign-off.
export function withApprovedRescreenCadenceOct31(path: string, source: string): string {
  const approval = fixture[path as keyof typeof fixture];
  if (!approval) return source;
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  if (hash(source) !== approval.priorHash) throw new Error(`R53 prior source changed: ${path}`);
  let result = source;
  for (const [anchor, replacement] of approval.edits) {
    if (result.split(anchor).length !== 2) throw new Error(`R53 anchor not exactly once: ${path}`);
    result = result.replace(anchor, () => replacement);
  }
  if (hash(result) !== approval.updatedHash) throw new Error(`R53 replacement changed: ${path}`);
  return result;
}