import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fixture from './engagementFinishNov01.fixture.json';
import { withApprovedEngagementFinishNov01 } from './engagementFinishNov01Approved';
it.each(Object.entries(fixture))('R57 explicit finish approval %s exact apply, drift and reapplication refusal', (path, entry) => {
  expect(withApprovedEngagementFinishNov01(path, entry.priorSource)).toBe(entry.updatedSource);
  expect(readFileSync(path, 'utf8')).toBe(entry.updatedSource);
  expect(() => withApprovedEngagementFinishNov01(path, entry.priorSource + '\n')).toThrow('prior source changed');
  expect(() => withApprovedEngagementFinishNov01(path, entry.updatedSource)).toThrow('prior source changed');
});
it('paging isolation changes only the approved new module mock', () => {
  const entry = fixture['src/components/__tests__/staffTable8b1Closeout.test.tsx'];
  expect(entry.updatedSource.replace(entry.edits[0][1], entry.edits[0][0])).toBe(entry.priorSource);
});
