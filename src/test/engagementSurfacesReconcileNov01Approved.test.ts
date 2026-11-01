import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fixture from './engagementSurfacesReconcileNov01.fixture.json';
import { withApprovedEngagementSurfacesReconcileNov01 } from './engagementSurfacesReconcileNov01Approved';
it.each(Object.entries(fixture))('R57 standing exception %s exact apply, drift and reapplication refusal', (path, entry) => {
  expect(withApprovedEngagementSurfacesReconcileNov01(path, entry.priorSource)).toBe(entry.updatedSource);
  expect(readFileSync(path, 'utf8')).toBe(entry.updatedSource);
  expect(() => withApprovedEngagementSurfacesReconcileNov01(path, entry.priorSource + '\n')).toThrow('prior source changed');
  expect(() => withApprovedEngagementSurfacesReconcileNov01(path, entry.updatedSource)).toThrow('prior source changed');
});
it('new R57 type-only fix preserves all assertions, inputs and expected values', () => {
  const entry = fixture['src/components/__tests__/engagementSurfacesR57.test.tsx'];
  expect(entry.updatedSource.replace("{ name: 'Close' }", "{ name: 'Close', exact: true }")).toBe(entry.priorSource);
});