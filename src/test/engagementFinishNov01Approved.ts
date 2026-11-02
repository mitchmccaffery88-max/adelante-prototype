import { createHash } from 'node:crypto';
import fixture from './engagementFinishNov01.fixture.json';
// Mitch's explicit 1 Nov 18:32 CT approval; not a standing exception.
export function withApprovedEngagementFinishNov01(path: string, source: string): string {
  const entry = fixture[path as keyof typeof fixture];
  if (!entry) return source;
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  if (hash(source) !== entry.priorHash) throw new Error('R57 finish prior source changed: ' + path);
  let result = source;
  for (const [before, after] of entry.edits) {
    if (result.split(before).length !== 2) throw new Error('R57 finish anchor not exactly once: ' + path);
    result = result.replace(before, () => after);
  }
  if (hash(result) !== entry.updatedHash) throw new Error('R57 finish replacement changed: ' + path);
  return result;
}
