// Privacy P3 (Mitch, Oct 20, delegated approval) — the ONLY approved source
// changes to files earlier parity tests pin to their rollbacks. Parity tests
// apply these exact substitutions to the rollback text; anything else must
// still match byte-for-byte / binding-for-binding.
const imp = 'import { staffPatientLabel, viewerCanOpenChart } from "@/lib/staffPatientLabel";\n';
const impLabel = 'import { staffPatientLabel } from "@/lib/staffPatientLabel";\n';
const P3: Record<string, [string, string][]> = {
  "src/components/ops/OpsWorkspace.tsx": [
    ['import { useEffect, useState, type ReactNode } from "react";', impLabel + 'import { useEffect, useState, type ReactNode } from "react";'],
    ["const name = (pid: string) => { const p = patients.find((x) => x.id === pid); return p ? `${p.firstName} ${p.lastName}` : pid; };",
      "const name = (pid: string) => (patients.some((x) => x.id === pid) ? staffPatientLabel({ role, staffId }, pid) : pid);"],
  ],
  "src/routes/quality-compliance.tsx": [
    ['import { StaffTable } from "@/components/staff/StaffTable";', impLabel + 'import { StaffTable } from "@/components/staff/StaffTable";'],
    ["name: `${p.firstName} ${p.lastName}`, restricted", "name: staffPatientLabel({ role, staffId }, p.id), restricted"],
  ],
  "src/components/tasks/TaskQueueCard.tsx": [
    ['import { StaffTable } from "@/components/staff/StaffTable";', imp + 'import { StaffTable } from "@/components/staff/StaffTable";'],
    ["  const patients = useEhr(() => AdelanteEHR.listPatients());\n",
      "  const patients = useEhr(() => AdelanteEHR.listPatients());\n  const viewer = useActingStaff();\n  const labelViewer = () => ({ role: viewer.role, staffId: viewer.staffId });\n"],
    ['patientSlot={p ? <Button size="sm" variant="link" onClick={() => onOpenPatient(p.id)}>{p.firstName} {p.lastName}</Button> : null}',
      'patientSlot={p ? (viewerCanOpenChart(labelViewer(), p.id) ? <Button size="sm" variant="link" onClick={() => onOpenPatient(p.id)}>{staffPatientLabel(labelViewer(), p.id)}</Button> : <span className="font-mono text-sm">{p.programId}</span>) : null}'],
  ],
  "src/lib/asamReporting.ts": [
    ['export const TOTALS_ONLY_ROLES: StaffRole[] = ["clinical_coordinator"];',
      '// Privacy P3 (Mitch, Oct 20) — sys_admin: de-identified totals only, same consent-only cohort.\nexport const TOTALS_ONLY_ROLES: StaffRole[] = ["clinical_coordinator", "sys_admin"];'],
  ],
};

/** Rollback text with only the approved P3 substitutions applied (each must match exactly once). */
export function withApprovedP3(path: string, rollbackText: string): string {
  let s = rollbackText;
  for (const [from, to] of P3[path] ?? []) {
    if (s.split(from).length !== 2) throw new Error(`Approved P3 anchor not found once in ${path}`);
    s = s.replace(from, to);
  }
  return s;
}
