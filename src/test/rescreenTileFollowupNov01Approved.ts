import { createHash } from "node:crypto";
import fixture from "./rescreenTileFollowupNov01.fixture.json";
// Mitch, 1 Nov 11:50 CT: staff override of automatic prompts and due wording.
// Draft — pending clinical sign-off. Chained after the original tile approval.
export function withApprovedRescreenTileFollowupNov01(path: string, source: string): string {
  const approval = fixture[path as keyof typeof fixture];
  if (!approval) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== approval.priorHash) throw new Error(`R53 tile follow-up prior source changed: ${path}`);
  let result = source;
  for (const [anchor, replacement] of approval.edits) {
    if (result.split(anchor).length !== 2) throw new Error(`R53 tile follow-up anchor not exactly once: ${path}`);
    result = result.replace(anchor, () => replacement);
  }
  if (hash(result) !== approval.updatedHash) throw new Error(`R53 tile follow-up replacement changed: ${path}`);
  return result;
}