import {readFileSync} from 'node:fs';
import {it,expect,describe} from 'vitest';
import fixture from './engagementRiskReconcileNov01.fixture.json';
import {withApprovedEngagementRiskReconcileNov01} from './engagementRiskReconcileNov01Approved';
describe('R57 standing OK exact-once reconciliation',()=>{
 it.each(Object.entries(fixture))('%s exact apply, drift and reapplication',(path,a)=>{
 expect(withApprovedEngagementRiskReconcileNov01(path,a.priorSource)).toBe(a.updatedSource);
 expect(readFileSync(path,'utf8')).toBe(a.updatedSource);
 expect(()=>withApprovedEngagementRiskReconcileNov01(path,a.priorSource+'\n')).toThrow('prior source changed');
 expect(()=>withApprovedEngagementRiskReconcileNov01(path,a.updatedSource)).toThrow('prior source changed');
 });
 it('type fix changes only return annotation, no assertion or input',()=>{
 const a=fixture['src/lib/__tests__/engagementRiskAutomationR57.test.ts'];
 expect(a.priorSource.replace('get body(){','get body(): string {')).toBe(a.updatedSource);
 });
});
