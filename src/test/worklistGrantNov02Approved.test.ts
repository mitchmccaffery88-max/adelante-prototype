import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import fixture from './worklistGrantNov02.fixture.json';
import { withApprovedWorklistGrantNov02 } from './worklistGrantNov02Approved';
describe('R57 follow-up 3 approved exact-once roles.ts re-pin', () => {
  it.each(Object.entries(fixture))('%s exact apply and current source', (path, a) => {
    expect(withApprovedWorklistGrantNov02(path, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(path, 'utf8')).toBe(a.updatedSource);
  });
  it.each(Object.entries(fixture))('%s refuses drift and reapplication', (path, a) => {
    expect(() => withApprovedWorklistGrantNov02(path, a.priorSource + '\n')).toThrow('prior source changed');
    expect(() => withApprovedWorklistGrantNov02(path, a.updatedSource)).toThrow('prior source changed');
  });
  it('covers only the three worklist grant lines', () => {
    const [[p, a]] = Object.entries(fixture);
    expect(p).toBe('src/lib/roles.ts');
    expect(a.edits).toHaveLength(2);
    expect(a.edits[0][1]).toContain('clinical_coordinator: "write"');
    expect(a.edits[1][1]).toContain('worklist: ["write", "write"]');
  });
  it('chains immediately after the latest adapter', () => {
    const chain = readFileSync('src/test/credentialingOct27Approved.ts', 'utf8');
    expect(chain).toContain('return withApprovedWorklistGrantNov02(path, withApprovedEngagementFinishNov01(path,');
  });
  it('unrelated source is unchanged', () => expect(withApprovedWorklistGrantNov02('src/lib/ehr.ts', 'same')).toBe('same'));
});
