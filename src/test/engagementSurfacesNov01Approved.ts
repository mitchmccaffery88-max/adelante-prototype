import { createHash } from 'node:crypto';
import fixture from './engagementSurfacesNov01.fixture.json';
// Mitch R57 part 2: presentation only, after the R57 event type approval.
export function withApprovedEngagementSurfacesNov01(path: string, source: string): string {
  const entry = fixture[path as keyof typeof fixture];
  if (!entry) return source;
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  if (hash(source) !== entry.priorHash) throw new Error(`R57 surface prior source changed: ${path}`);
  let result = source;
  for (const [before, after] of entry.edits) {
    if (result.split(before).length !== 2) throw new Error(`R57 surface anchor not exactly once: ${path}`);
    result = result.replace(before, () => after);
  }
  if (hash(result) !== entry.updatedHash) throw new Error(`R57 surface replacement changed: ${path}`);
  return result;
}