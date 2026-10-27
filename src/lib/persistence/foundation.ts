import type { AccessLevel, RecordClass, StaffRole } from '../roles';
export const PERSISTENCE_DOMAINS = ['accounts','staff_roles','feature_flags','audit','consent','patients_core'] as const;
export type PersistenceDomain = typeof PERSISTENCE_DOMAINS[number];
export const FOUNDATION_FLAGS = PERSISTENCE_DOMAINS.map(domain => ({ id: `persist_${domain}`, default: false, simulated: false }));
export interface FoundationContext { account_id: string | null; org_id: string | null; role: StaffRole | null; kind: 'staff'|'patient'|'advocate'|null; attested: boolean }
export interface FoundationRecord { id: string; org_id: string; [field: string]: unknown }
export interface FoundationRepository {
 list(domain: PersistenceDomain): Promise<FoundationRecord[]>;
 context(): Promise<FoundationContext>;
 command(command: 'attest'|'set_role', value: string): Promise<unknown>;
}
/** Existing memory store supplies reads and gated commands; no second seed/store. */
export function memoryFoundationRepository(port: FoundationRepository): FoundationRepository { return port; }
export function selectFoundationRepository(domain: PersistenceDomain, flags: Readonly<Record<string,boolean>>, memory: FoundationRepository, persisted: FoundationRepository): FoundationRepository {
 return flags[`persist_${domain}`] === true ? persisted : memory;
}
export interface FoundationGrant { role: StaffRole; record_class: RecordClass; level: AccessLevel }
export const BETA_STATEMENT_VERSION = 'fictional-only-v1';
export const BETA_COPY = {
 en: { banner: 'Beta — fictional data only', title: 'Use fictional information only', statement: 'I will use only fictional people and information. I will not upload real files or enter real patient information.', agree: 'I agree', pending: 'Your Beta access is being checked.', draft: '' },
 es: { banner: 'Beta — solo datos ficticios', title: 'Usa solo información ficticia', statement: 'Usaré solo personas e información ficticias. No subiré archivos reales ni ingresaré información real de pacientes.', agree: 'Acepto', pending: 'Estamos verificando tu acceso a la Beta.', draft: 'Borrador — pendiente de revisión de traducción' },
} as const;