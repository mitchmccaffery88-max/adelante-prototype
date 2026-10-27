import { describe,it,expect } from 'vitest';
import grants from '../persistence/grants.generated.json';
import { canAccess, STAFF_ROLES, type StaffRole, type RecordClass } from '../roles';
import { FOUNDATION_FLAGS, selectFoundationRepository, type FoundationRepository } from '../persistence/foundation';
describe('27 Oct Phase 1 foundation',()=>{
 it('covers all 44 classes × 18 roles, including explicit denials',()=>{
  expect(grants).toHaveLength(792); expect(new Set(grants.map(r=>r.record_class)).size).toBe(44); expect(new Set(grants.map(r=>r.role)).size).toBe(18);
  for(const row of grants){const actual=canAccess(row.role as StaffRole,row.record_class as RecordClass); expect(row.level==='consent_gated'?'none':row.level).toBe(actual.level);}
  expect(STAFF_ROLES).toHaveLength(18);
 });
 it('physician inherits every PMHNP grant',()=>{for(const row of grants.filter(r=>r.role==='physician')) expect(row.level).toBe(grants.find(r=>r.role==='pmhnp'&&r.record_class===row.record_class)?.level)});
 it('defaults every persistence domain to memory',()=>{const memory={} as FoundationRepository;const database={} as FoundationRepository; for(const flag of FOUNDATION_FLAGS){expect(flag.default).toBe(false); expect(selectFoundationRepository(flag.id.slice(8) as 'accounts',{},memory,database)).toBe(memory)}});
 it('selects only the explicitly enabled domain',()=>{const memory={} as FoundationRepository;const database={} as FoundationRepository;expect(selectFoundationRepository('consent',{persist_consent:true},memory,database)).toBe(database);expect(selectFoundationRepository('accounts',{persist_consent:true},memory,database)).toBe(memory)});
});