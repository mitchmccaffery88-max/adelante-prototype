import { describe, expect, it } from 'vitest';
import { PHASE2_DOMAINS, PHASE2_FLAGS, memoryPhase2Repository, packetProjection, selectPhase2Repository, supabasePhase2Repository, type Phase2Repository } from '../persistence/phase2';

const empty: Phase2Repository = { list: async () => [], packetDocuments: async () => [] };
describe('Phase 2 closed repository contracts', () => {
  it.each(PHASE2_DOMAINS)('%s remains memory by default', domain => {
    const memory = memoryPhase2Repository(empty);
    const persisted = supabasePhase2Repository({ ...empty });
    expect(selectPhase2Repository(domain, {}, memory, persisted)).toBe(memory);
    expect(PHASE2_FLAGS.find(flag => flag.id === `persist_${domain}`)?.default).toBe(false);
  });
  it('never exposes filename, source or contents on a locked Part 2 row', () => {
    expect(packetProjection([{ id: 'packet-1', locked: true, reason: 'Part 2 — needs consent covering intake/treatment', file_name: 'restricted.txt', source: 'pre_release_packet', text: 'private' }])).toEqual([{ id: 'packet-1', locked: true, reason: 'Part 2 — needs consent covering intake/treatment' }]);
  });
  it('unlocked metadata never claims stored content is available before phase 5', () => {
    expect(packetProjection([{ id: 'packet-1', locked: false, document_type: 'medication_list', source: 'pre_release_packet', file_name: 'fictional.txt', contentAvailable: true, storage_path: 'private/file' }])).toEqual([{ id: 'packet-1', locked: false, document_type: 'medication_list', source: 'pre_release_packet', file_name: 'fictional.txt', contentAvailable: false }]);
  });
  it('fails closed for malformed projections', () => {
    expect(packetProjection([{ id: 'packet-1', locked: false, text: 'private' }, { locked: true, reason: 'private' }, null])).toEqual([]);
    expect(packetProjection({ id: 'packet-1' })).toEqual([]);
  });
});