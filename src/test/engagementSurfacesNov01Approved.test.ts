import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fixture from './engagementSurfacesNov01.fixture.json';
import { withApprovedEngagementSurfacesNov01 } from './engagementSurfacesNov01Approved';
it.each(Object.entries(fixture))('R57 staff surface %s exact apply and current source', (path, entry) => {
  expect(withApprovedEngagementSurfacesNov01(path, entry.priorSource)).toBe(entry.updatedSource);
  expect(readFileSync(path, 'utf8')).toBe(entry.updatedSource);
});
it.each(Object.entries(fixture))('R57 staff surface %s refuses drift and reapplication', (path, entry) => {
  expect(() => withApprovedEngagementSurfacesNov01(path, entry.priorSource + '\n')).toThrow('prior source changed');
  expect(() => withApprovedEngagementSurfacesNov01(path, entry.updatedSource)).toThrow('prior source changed');
});
it('R57 staff surface follows the latest event type approval', () => {
  expect(readFileSync('src/test/credentialingOct27Approved.ts', 'utf8')).toContain('withApprovedEngagementSurfacesNov01(path, withApprovedEngagementRiskEventsTypeNov01(path,');
});