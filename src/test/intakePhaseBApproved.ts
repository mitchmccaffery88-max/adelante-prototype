// 26 Oct Phase B (Mitch): exact-once Intake-only result-entry denials.
// Every existing-role result writer and all other EHR bytes remain pinned.
export function withIntakePhaseB(path: string, source: string): string {
  if (path !== "src/lib/ehr.ts") return source;
  const deltas: [string, string][] = [
    [
      '  ): { ok: boolean; error?: string } {\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) return { ok: false, error: "Patient not found." };\n    // §Phase 8b — "reported" is reserved for recordIntakeBenefits;',
      '  ): { ok: boolean; error?: string } {\n    // 26 Oct Phase B: Intake requests checks; never enters results.\n    if (input.actorRole === "intake_coordinator") return { ok: false, error: "Billing-owned results only." };\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) return { ok: false, error: "Patient not found." };\n    // §Phase 8b — "reported" is reserved for recordIntakeBenefits;'
    ],
    [
      '  ): { ok: boolean; error?: string; recordId?: string; spanId?: string; spanAction?: "added" | "updated" | "none"; taskId?: string } {\n    const p = patients.find((x) => x.id === patientId);',
      '  ): { ok: boolean; error?: string; recordId?: string; spanId?: string; spanAction?: "added" | "updated" | "none"; taskId?: string } {\n    // 26 Oct Phase B: no electronic result-entry capability for Intake.\n    if (input.actorRole === "intake_coordinator") return { ok: false, error: "Billing-owned results only." };\n    const p = patients.find((x) => x.id === patientId);'
    ],
  ];
  for (const [from, to] of deltas) { if (source.split(from).length !== 2) throw new Error(`Phase B anchor not found exactly once in ${path}`); source = source.replace(from, to); }
  return source;
}