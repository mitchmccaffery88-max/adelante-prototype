import { createHash } from 'node:crypto';
import fixture from './worklistGrantNov02.fixture.json';
// Mitch 2 Nov 12:52 CT option B. Draft — pending clinical sign-off.
// Applied after engagementFinishNov01Approved; only the three worklist grant lines and their comments.
export function withApprovedWorklistGrantNov02(path: string, source: string): string {
  const a = fixture[path as keyof typeof fixture];
  if (!a) return source;
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  if (hash(source) !== a.priorHash) throw new Error(`Worklist grant prior source changed: ${path}`);
  let out = source;
  for (const [before, after] of a.edits) {
    if (out.split(before).length !== 2) throw new Error(`Worklist grant anchor not exactly once: ${path}`);
    out = out.replace(before, () => after);
  }
  if (hash(out) !== a.updatedHash) throw new Error(`Worklist grant replacement changed: ${path}`);
  return out;
}
