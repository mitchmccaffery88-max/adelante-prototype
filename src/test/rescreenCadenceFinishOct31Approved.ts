import { createHash } from "node:crypto";
import fixture from "./rescreenCadenceFinishOct31.fixture.json";
// Mitch, 31 Oct 18:25 CT. Draft — pending clinical sign-off.
export function withApprovedRescreenCadenceFinishOct31(path: string, source: string): string {
  const approval = fixture[path as keyof typeof fixture];
  if (!approval) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== approval.priorHash) throw new Error(`R53 finish prior source changed: ${path}`);
  let result = source;
  for (const [anchor, replacement] of approval.edits) {
    if (result.split(anchor).length !== 2) throw new Error(`R53 finish anchor not exactly once: ${path}`);
    result = result.replace(anchor, () => replacement);
  }
  if (hash(result) !== approval.updatedHash) throw new Error(`R53 finish replacement changed: ${path}`);
  return result;
}