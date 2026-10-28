// Friday cleanup (Mitch, Oct 23) — pins the patient-name sweep: every staff
// surface traced in docs/privacy-p3-report.md §1 now labels patients through
// staffPatientLabel / viewerCanOpenChart, and identity-matching screens keep
// comparison names only for the roles allowed to decide matches.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { staffPatientLabel, viewerCanOpenChart } from "@/lib/staffPatientLabel";
import { STAFF_ROSTER } from "@/lib/roles";

const src = (p: string) => readFileSync(p, "utf8");

describe("Friday cleanup — name sweep source pins", () => {
  it.each([
    "src/routes/admin-audit.tsx",
    "src/routes/disclosure-log.tsx",
    "src/routes/cosign-inbox.tsx",
    "src/routes/caseload-review.tsx",
    "src/components/escalations/CrisisQueueDetails.tsx",
    "src/components/groups/GroupJoinRequestsQueue.tsx",
    "src/components/PostEnrollmentSetupCard.tsx",
    "src/components/afbi/AfbiContactForm.tsx",
    "src/components/clinician/DashboardActionLauncher.tsx",
    "src/routes/agentic.index.tsx",
    "src/routes/agentic.scribe.$patientId.tsx",
    "src/routes/case-manager.tsx",
    "src/routes/clinician.tsx",
    "src/components/clinician/WorkspaceDashboard.tsx",
  ])("%s labels patients through staffPatientLabel", (path) => {
    expect(src(path)).toContain("staffPatientLabel");
  });

  it.each([
    "src/routes/admin-documents-audit.tsx",
    "src/routes/group-audit.tsx",
    "src/routes/clinical-referrals.tsx",
    "src/routes/agentic.chart-review.$patientId.tsx",
  ])("%s gates the name on viewerCanOpenChart", (path) => {
    expect(src(path)).toContain("viewerCanOpenChart");
  });

  it("the disclosure log never abbreviates a name (first + last initial is still a name)", () => {
    expect(src("src/routes/disclosure-log.tsx")).not.toContain("lastName.slice");
  });

  it("the quick-peek drawer is wrapped in the restricted-chart gate", () => {
    const s = src("src/components/ClientRecordDrawer.tsx");
    expect(s).toContain('import { RestrictedChartGate } from "@/components/chart/RestrictedChartGate";');
    expect(s).toContain("<RestrictedChartGate patientId={patientId}>");
  });

  it("identity-matching screens keep comparison names (merge-decision roles only)", () => {
    // PatientMatchingQueue + ExistingPersonStep legitimately compare names for
    // clinical_coordinator / sys_admin (merge queue) and the assisted-signup
    // roles; they are the documented exception and must NOT be swept.
    expect(src("src/components/identity/PatientMatchingQueue.tsx")).not.toContain("staffPatientLabel");
    expect(src("src/components/identity/ExistingPersonStep.tsx")).not.toContain("staffPatientLabel");
  });
});

describe("Friday cleanup — label behaviour", () => {
  it("prototype sys_admin oversight entry permits the existing name label", () => {
    const p = AdelanteEHR.listPatients()[0];
    const admin = STAFF_ROSTER.find((s) => s.role === "sys_admin")!;
    expect(viewerCanOpenChart({ role: admin.role, staffId: admin.id }, p.id)).toBe(true);
    expect(staffPatientLabel({ role: admin.role, staffId: admin.id }, p.id)).toBe(`${p.firstName} ${p.lastName}`);
    expect(staffPatientLabel({ role: admin.role, staffId: admin.id }, p.id)).toContain(p.firstName);
  });
});
