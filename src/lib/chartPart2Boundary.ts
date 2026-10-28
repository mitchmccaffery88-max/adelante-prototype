// 28 Oct access-rules decision: entry is not a Part 2 grant. Matrix stays owned by roles.ts.
type EntryBasis = { directTreatment: boolean; reasonOnly: boolean };
let reader: ((role: string, staffId: string | undefined, patientId: string) => EntryBasis) | undefined;
export function registerChartPart2Basis(next: typeof reader) { reader = next; }
export function chartPart2Basis(role: string, staffId: string | undefined, patientId: string): EntryBasis {
  return reader?.(role, staffId, patientId) ?? { directTreatment: false, reasonOnly: false };
}