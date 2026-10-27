import type { FoundationRecord } from './foundation';

/** Closed Phase 2 read contracts; mutation/cutover is deliberately unavailable. */
export const PHASE2_DOMAINS = ['chart_context', 'advocates', 'referrals', 'signup', 'identity_review', 'account_support', 'website_inbox', 'intake', 'staging', 'packet_documents', 'on_call'] as const;
export type Phase2Domain = typeof PHASE2_DOMAINS[number];
export const PHASE2_FLAGS = PHASE2_DOMAINS.map(domain => ({ id: `persist_${domain}`, default: false as const, simulated: false as const }));
export interface LockedPacketDocument { id: string; locked: true; reason: string }
export interface AvailablePacketDocument { id: string; locked: false; document_type: string; source: string; file_name: string; contentAvailable: false }
export type PacketDocumentProjection = LockedPacketDocument | AvailablePacketDocument;
export interface Phase2Repository {
  list(domain: Phase2Domain): Promise<FoundationRecord[]>;
  packetDocuments(referralId: string): Promise<PacketDocumentProjection[]>;
}
export function memoryPhase2Repository(port: Phase2Repository): Phase2Repository { return port; }
export function supabasePhase2Repository(port: Phase2Repository): Phase2Repository { return port; }
export function selectPhase2Repository(domain: Phase2Domain, flags: Readonly<Record<string, boolean>>, memory: Phase2Repository, persisted: Phase2Repository): Phase2Repository {
  return flags[`persist_${domain}`] === true ? persisted : memory;
}
/** Project untrusted RPC output without retaining any extra locked fields. */
export function packetProjection(input: unknown): PacketDocumentProjection[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((value): PacketDocumentProjection[] => {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string') return [];
    if (value.locked === true && typeof value.reason === 'string') return [{ id: value.id, locked: true, reason: value.reason }];
    if (value.locked === false && typeof value.document_type === 'string' && typeof value.source === 'string' && typeof value.file_name === 'string') {
      return [{ id: value.id, locked: false, document_type: value.document_type, source: value.source, file_name: value.file_name, contentAvailable: false }];
    }
    return [];
  });
}