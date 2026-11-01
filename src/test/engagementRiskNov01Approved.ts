import { createHash } from 'node:crypto';
import fixture from './engagementRiskNov01.fixture.json';
// Mitch 1 Nov 16:55 CT option A. Draft — pending clinical sign-off.
// Applied after rescreenTileActorNov01Approved; no other source edits accepted.
export function withApprovedEngagementRiskNov01(path: string, source: string): string {
  const a = fixture[path as keyof typeof fixture];
  if (!a) return source;
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  if (hash(source) !== a.priorHash) throw new Error(`R57 prior source changed: ${path}`);
  let out = source;
  for (const [before, after] of a.edits) {
    if (out.split(before).length !== 2) throw new Error(`R57 anchor not exactly once: ${path}`);
    out = out.replace(before, () => after);
  }
  if (hash(out) !== a.updatedHash) throw new Error(`R57 replacement changed: ${path}`);
  return out;
}
