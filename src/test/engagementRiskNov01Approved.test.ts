import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import fixture from './engagementRiskNov01.fixture.json';
import { withApprovedEngagementRiskNov01 } from './engagementRiskNov01Approved';
describe('R57 approved exact-once source changes', () => {
  it.each(Object.entries(fixture))('%s exact apply and current source', (path, a) => {
    expect(withApprovedEngagementRiskNov01(path, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(path, 'utf8')).toBe(a.updatedSource);
  });
  it.each(Object.entries(fixture))('%s refuses drift and reapplication', (path, a) => {
    expect(() => withApprovedEngagementRiskNov01(path, a.priorSource + '\n')).toThrow('prior source changed');
    expect(() => withApprovedEngagementRiskNov01(path, a.updatedSource)).toThrow('prior source changed');
  });
  it('chains immediately after the latest actor approval', () => {
    const chain = readFileSync('src/test/credentialingOct27Approved.ts', 'utf8');
    expect(chain).toContain('const r57Prior = withApprovedRescreenTileActorNov01(path,');
    expect(chain).toContain('return withApprovedEngagementRiskNov01(path, r57Prior);');
  });
  it('unrelated source is unchanged', () => expect(withApprovedEngagementRiskNov01('src/lib/roles.ts', 'same')).toBe('same'));
});
