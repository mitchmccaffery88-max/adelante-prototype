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
  // Friday cleanup (Mitch, Oct 23) — name-label sweep: the only inventory-visible
  // changes in pinned files are these new acting-staff declarations and the
  // WorkspaceDashboard "Next visit" strip value (name → staffPatientLabel).
  "src/routes/clinician.tsx": [
    ["  onBack: () => void;\n}) {\n  return (\n    <Card className=\"p-4\">",
      "  onBack: () => void;\n}) {\n  const headerActor = useActingStaff();\n  return (\n    <Card className=\"p-4\">"],
    ["  // (component continues below)\n  const { t } = useI18n();",
      "  // (component continues below)\n  const { t } = useI18n();\n  const rescreenActor = useActingStaff();"],
    ["  const clinicians = AdelanteEHR.listClinicians();\n  if (!clinicianId || outgoing.length === 0) return null;",
      "  const clinicians = AdelanteEHR.listClinicians();\n  const switchActor = useActingStaff();\n  if (!clinicianId || outgoing.length === 0) return null;"],
  ],
  "src/components/clinician/WorkspaceDashboard.tsx": [
    ['    { id: "next", label: "Next visit", value: next ? `${new Date(next.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${nextPatient?.firstName ?? "Patient"}` : "None", tile: "schedule" as const, segment: "up_next" as const, zero: !next },',
      '    { id: "next", label: "Next visit", value: next ? `${new Date(next.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${nextPatient ? staffPatientLabel({ role: acting.role, staffId: acting.staffId }, nextPatient.id) : "Patient"}` : "None", tile: "schedule" as const, segment: "up_next" as const, zero: !next },'],
    ["function CaseloadTile({ rows }: { rows: ReturnType<typeof attentionCaseload> }) { return <div className=\"divide-y\">{rows.map(({ patient, reasons }) => <div key={patient.id} className=\"flex items-center justify-between gap-3 py-2\"><div className=\"min-w-0\"><p className=\"truncate text-sm font-medium\">{patient.firstName} {patient.lastName}</p>",
      "function CaseloadTile({ rows }: { rows: ReturnType<typeof attentionCaseload> }) { const caseloadActor = useActingStaff(); return <div className=\"divide-y\">{rows.map(({ patient, reasons }) => <div key={patient.id} className=\"flex items-center justify-between gap-3 py-2\"><div className=\"min-w-0\"><p className=\"truncate text-sm font-medium\">{staffPatientLabel({ role: caseloadActor.role, staffId: caseloadActor.staffId }, patient.id)}</p>"],
  ],
  "src/lib/asamReporting.ts": [
    ['export const TOTALS_ONLY_ROLES: StaffRole[] = ["clinical_coordinator"];',
      '// Privacy P3 (Mitch, Oct 20) — sys_admin: de-identified totals only, same consent-only cohort.\nexport const TOTALS_ONLY_ROLES: StaffRole[] = ["clinical_coordinator", "sys_admin"];'],
    ['export function coordinatorConsentedPatients(): Patient[] {\n  return AdelanteEHR.listPatients().filter((p) => !!p.sudCoordinationConsent && p.consents.part2Sud);\n}',
      'import { consentGate, coordinatorNeed } from "@/lib/consentGate";\nexport function coordinatorConsentedPatients(): Patient[] {\n  return AdelanteEHR.listPatients().filter((p) => consentGate(p.id, coordinatorNeed("diagnoses"), () => !!p.sudCoordinationConsent && p.consents.part2Sud));\n}'],
    // B2-5 (Mitch review, Oct 23) — additive: the flag-reading live answer becomes () => false.
    ['consentGate(p.id, coordinatorNeed("diagnoses"), () => !!p.sudCoordinationConsent && p.consents.part2Sud));',
      'consentGate(p.id, coordinatorNeed("diagnoses"), () => false));'],
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
