import { createHash } from 'node:crypto';
import fixture from './engagementRiskReconcileNov01.fixture.json';
// Standing OK: four superseded baseline regressions and one R57 type-only annotation.
export function withApprovedEngagementRiskReconcileNov01(path: string, source: string): string {
  const a = fixture[path as keyof typeof fixture]; if (!a) return source;
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  if (hash(source) !== a.priorHash) throw new Error(`R57 reconcile prior source changed: ${path}`);
  let out = source;
  for (const [before, after] of a.edits) { if (out.split(before).length !== 2) throw new Error(`R57 reconcile anchor not exactly once: ${path}`); out = out.replace(before, () => after); }
  if (hash(out) !== a.updatedHash) throw new Error(`R57 reconcile replacement changed: ${path}`);
  return out;
}
