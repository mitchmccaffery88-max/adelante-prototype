// §Batch A3 — dependency-free hard guard: a field outreach (AFBI) contact can
// never become a Medi-Cal claim. Every claim creator in ehr-ext.ts calls this
// with the id(s) it was handed, so no claim path can accept an AFBI record.
export const AFBI_ID_PREFIX = "afbi-";
export const AFBI_NOT_CLAIMABLE = "Field outreach (AFBI) contacts are never billed to Medi-Cal.";

export function isAfbiId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith(AFBI_ID_PREFIX);
}

export function assertNotAfbiSource(...ids: unknown[]): void {
  if (ids.some(isAfbiId)) throw new Error(AFBI_NOT_CLAIMABLE);
}
