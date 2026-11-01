import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import fixture from './engagementRiskEventsTypeNov01.fixture.json';
import {withApprovedEngagementRiskEventsTypeNov01} from './engagementRiskEventsTypeNov01Approved';
it('R57 event mock type-only exact apply, drift/reapplication and unchanged runtime text',()=>{
 const path='src/lib/__tests__/engagementRiskEventsR57.test.ts',a=fixture[path];
 expect(withApprovedEngagementRiskEventsTypeNov01(path,a.priorSource)).toBe(a.updatedSource);
 expect(readFileSync(path,'utf8')).toBe(a.updatedSource);
 expect(()=>withApprovedEngagementRiskEventsTypeNov01(path,a.priorSource+'\n')).toThrow('prior source changed');
 expect(()=>withApprovedEngagementRiskEventsTypeNov01(path,a.updatedSource)).toThrow('prior source changed');
 expect(a.updatedSource.replace(', type Appointment','').replace(' as unknown as Appointment[]','')).toBe(a.priorSource);
});
