import { createHash } from 'node:crypto';
import fixture from './myTasksNov02.fixture.json';
// R57 follow-up 2, Mitch 2 Nov 09:28 CT. Draft.
// Applied after worklistGrantNov02Approved; only the four TaskQueueCard "My tasks" anchors.
export function withApprovedMyTasksNov02(path: string, source: string): string {
  const a = fixture[path as keyof typeof fixture];
  if (!a) return source;
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  if (hash(source) !== a.priorHash) throw new Error(`My tasks prior source changed: ${path}`);
  let out = source;
  for (const [before, after] of a.edits) {
    if (out.split(before).length !== 2) throw new Error(`My tasks anchor not exactly once: ${path}`);
    out = out.replace(before, () => after);
  }
  if (hash(out) !== a.updatedHash) throw new Error(`My tasks replacement changed: ${path}`);
  return out;
}
