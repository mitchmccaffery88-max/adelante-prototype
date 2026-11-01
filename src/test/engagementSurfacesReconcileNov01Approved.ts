import { createHash } from 'node:crypto';
import fixture from './engagementSurfacesReconcileNov01.fixture.json';
// Standing OK: one superseded source anchor and one new R57 type-only option removal.
export function withApprovedEngagementSurfacesReconcileNov01(path: string, source: string): string {
  const entry = fixture[path as keyof typeof fixture];
  if (!entry) return source;
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  if (hash(source) !== entry.priorHash) throw new Error(`R57 reconcile prior source changed: ${path}`);
  let result = source;
  for (const [before, after] of entry.edits) {
    if (result.split(before).length !== 2) throw new Error(`R57 reconcile anchor not exactly once: ${path}`);
    result = result.replace(before, () => after);
  }
  if (hash(result) !== entry.updatedHash) throw new Error(`R57 reconcile replacement changed: ${path}`);
  return result;
}