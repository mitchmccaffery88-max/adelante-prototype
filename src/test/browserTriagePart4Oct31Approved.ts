import { createHash } from "node:crypto";
import { withApprovedBrowserTriagePart3Oct31 } from "./browserTriagePart3Oct31Approved";
import fixture from "./browserTriagePart4Oct31.fixture.json";

// Mitch approved 31 Oct: Today/closed existing off-team fixture only; no grants or seed writes.
const PRIOR_HASH = "741f8dd5e211417a1fde4241ceb04113557ecbb0c13b36aad398e0a721dafc51";
const REPLACEMENT_HASH = "eb99ad5643f89d110c248c88306ff05898131d5927ed8557062308e8ce310604";
const PRIOR_LINE = "  await page.getByRole(\"region\", { name: \"Today\", exact: true }).getByRole(\"button\", { name: \"ADL-2026-002\", exact: true }).click();";
const REPLACEMENT = "  const closedFixture = await page.evaluate(async () => {\n    const roles = await import(/* @vite-ignore */ \"/src/lib/roles.ts\");\n    const { scheduleSegments } = await import(/* @vite-ignore */ \"/src/lib/clinicianWorkspace.ts\");\n    const { resolveWorkspaceActor } = await import(/* @vite-ignore */ \"/src/lib/workspaceIdentity.ts\");\n    const { myCaseload } = await import(/* @vite-ignore */ \"/src/lib/myWork.ts\");\n    const { onCareTeam, chartEntryFor } = await import(/* @vite-ignore */ \"/src/lib/chartAccess.ts\");\n    const { staffPatientLabel } = await import(/* @vite-ignore */ \"/src/lib/staffPatientLabel.ts\");\n    const staff = roles.getActingStaff();\n    const actor = resolveWorkspaceActor({ role: roles.getActingRole(), staffId: staff.id, staffName: staff.name, clinicianId: staff.clinicianId, caseManagerId: staff.caseManagerId });\n    const ehr = (window as any).__adelante.AdelanteEHR;\n    const mine = new Set(myCaseload(actor).map((p) => p.id));\n    const appointments = actor.clinicianId ? ehr.appointmentsForClinician(actor.clinicianId) : ehr.listAppointments().filter((a: { patientId: string }) => mine.has(a.patientId));\n    const closed = scheduleSegments(appointments).closed;\n    const visit = closed.find((a) => {\n      const patient = ehr.getPatient(a.patientId);\n      const entry = chartEntryFor(actor.role, actor.staffId, a.patientId);\n      return patient && !onCareTeam(actor.staffId, patient) && !entry.ok && entry.reason === \"reason\";\n    });\n    return { actor: { role: actor.role, staffId: actor.staffId }, closedVisitIds: closed.map((a) => a.id), eligible: visit ? { visitId: visit.id, patientId: visit.patientId, label: staffPatientLabel(actor, visit.patientId) } : null };\n  });\n  expect(closedFixture.eligible, `fixture prerequisite missing: Today/closed has no eligible off-team reason-gated visit for ${closedFixture.actor.staffId}; closed visits: ${closedFixture.closedVisitIds.join(\", \") || \"none\"}`).not.toBeNull();\n  if (!closedFixture.eligible) throw new Error(\"fixture prerequisite missing: no eligible Today/closed visit\");\n  await page.getByRole(\"region\", { name: \"Today\", exact: true }).getByRole(\"button\", { name: closedFixture.eligible.label, exact: true }).click();";
export function withApprovedBrowserTriagePart4Oct31(path: string, priorSource: string): string {
  const source = withApprovedBrowserTriagePart3Oct31(path, priorSource);
  if (path !== fixture.path) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== PRIOR_HASH) throw new Error(`Browser triage Part 4 prior source changed: ${path}`);
  if (source.split(PRIOR_LINE).length !== 2) throw new Error(`Browser triage Part 4 anchor not exactly once: ${path}`);
  const updated = source.replace(PRIOR_LINE, () => REPLACEMENT);
  if (hash(updated) !== REPLACEMENT_HASH) throw new Error(`Browser triage Part 4 replacement changed: ${path}`);
  return updated;
}
