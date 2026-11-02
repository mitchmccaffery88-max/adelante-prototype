import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import fixture from './myTasksNov02.fixture.json';
import { withApprovedMyTasksNov02 } from './myTasksNov02Approved';
describe('R57 follow-up 2 approved exact-once TaskQueueCard re-pin', () => {
  it.each(Object.entries(fixture))('%s exact apply and current source', (path, a) => {
    expect(withApprovedMyTasksNov02(path, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(path, 'utf8')).toBe(a.updatedSource);
  });
  it.each(Object.entries(fixture))('%s refuses drift and reapplication', (path, a) => {
    expect(() => withApprovedMyTasksNov02(path, a.priorSource + '\n')).toThrow('prior source changed');
    expect(() => withApprovedMyTasksNov02(path, a.updatedSource)).toThrow('prior source changed');
  });
  it('covers only the four My tasks anchors', () => {
    const [[p, a]] = Object.entries(fixture);
    expect(p).toBe('src/components/tasks/TaskQueueCard.tsx');
    expect(a.edits).toHaveLength(4);
    expect(a.edits[2][1]).toContain('withDirectStaffTasks(AdelanteEHR.caseTasksForCM(source.cmId), source.staff)');
  });
  it('chains immediately after the latest adapter', () => {
    const chain = readFileSync('src/test/credentialingOct27Approved.ts', 'utf8');
    expect(chain).toContain('return withApprovedWorklistGrantNov02(path, withApprovedEngagementFinishNov01(path,');
    expect(chain).toContain('return withApprovedMyTasksNov02(path, latest);');
    expect(chain.indexOf('return withApprovedWorklistGrantNov02(')).toBeLessThan(chain.indexOf('return withApprovedMyTasksNov02(path, latest);'));
  });
  it('unrelated source is unchanged', () => expect(withApprovedMyTasksNov02('src/lib/ehr.ts', 'same')).toBe('same'));
});
