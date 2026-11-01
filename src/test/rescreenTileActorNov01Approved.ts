import { createHash } from "node:crypto";
import fixture from "./rescreenTileActorNov01.fixture.json";
// Mitch, 1 Nov 15:16 CT: type-only removal of `name` from one runAction actor literal.
// Draft — pending clinical sign-off. Chained after the R53 tile follow-up approval.
export function withApprovedRescreenTileActorNov01(path: string, source: string): string {
  const approval = fixture[path as keyof typeof fixture];
  if (!approval) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== approval.priorHash) throw new Error(`R53 tile actor prior source changed: ${path}`);
  let result = source;
  for (const [anchor, replacement] of approval.edits) {
    if (result.split(anchor).length !== 2) throw new Error(`R53 tile actor anchor not exactly once: ${path}`);
    result = result.replace(anchor, () => replacement);
  }
  if (hash(result) !== approval.updatedHash) throw new Error(`R53 tile actor replacement changed: ${path}`);
  return result;
}
