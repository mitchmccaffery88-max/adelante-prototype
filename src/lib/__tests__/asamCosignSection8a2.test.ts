// 8a-2 fixture: one ASAM draft awaiting co-signature, created only through the
// real store/orchestration functions inside this test process (the shared
// demo seed is not edited). Proves which My work section it lands in for its
// author and its co-signer, and that the set of roles that can see it is
// exactly the set that could already see that patient's ASAM rows.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { AdelanteEHR, asamCosignOwnership, demoScenarioPatientId } from "@/lib/ehr";
import { ASAM_DIMENSIONS } from "@/lib/asam";
import { signAsamAssessment } from "@/lib/asamFlow";
import { asamCosignRows, myAsamWork, roleSeesAsamRow } from "@/lib/asamReporting";
import { STAFF_ROLES, getStaffMember, type StaffRole } from "@/lib/roles";

const AUTHOR = { staffId: "s-sudc1", name: "Renee Castillo", role: "sud_counselor" as StaffRole };
const att = { attested: true, signatureDataUrl: "data:image/png;base64,Zml4dHVyZQ==" };

let asamId = "";
let patientId = "";
let rolesBefore: StaffRole[] = [];

beforeAll(() => {
  patientId = demoScenarioPatientId("sud_consented")!;
  const p = AdelanteEHR.getPatient(patientId)!;
  rolesBefore = STAFF_ROLES.map(r => r.key).filter(r => roleSeesAsamRow(r, p));
  const draft = AdelanteEHR.saveAsamDraft(patientId, {
    dimensions: ASAM_DIMENSIONS.map(d => ({ key: d.key, documentation: "Fixture documentation.", rating: 1 as const })),
    recommendedLevel: "outpatient",
    actualLevel: "outpatient",
  }, AUTHOR);
  asamId = signAsamAssessment(patientId, draft.id, AUTHOR, att).id;
});

const myWorkSource = readFileSync("src/routes/my-work.tsx", "utf8");
const waitingIds = JSON.parse(myWorkSource.match(/waitingIds=\{(\[[^\]]*\])\}/)![1]) as string[];

describe("8a-2 ASAM draft awaiting co-signature", () => {
  it("is cosign_pending", () => {
    expect(AdelanteEHR.listAsamAwaitingCosign().some(r => r.asam.id === asamId)).toBe(true);
  });

  it("lands in Waiting on others for its author", () => {
    const work = myAsamWork({ role: AUTHOR.role, staffId: AUTHOR.staffId, staffName: AUTHOR.name })!;
    expect(work.myDraftsAwaitingCosign.map(c => c.asamId)).toContain(asamId);
    expect(work.cosignsForMe.map(c => c.asamId)).not.toContain(asamId);
    // Rendered in the "my-work-asam-waiting" section, which My work groups as waiting.
    expect(myWorkSource).toContain('data-testid="my-work-asam-waiting"');
    expect(waitingIds).toContain("my-work-asam-waiting");
  });

  it("lands in Needs you for its co-signer", () => {
    const row = AdelanteEHR.listAsamAwaitingCosign().find(r => r.asam.id === asamId)!;
    const own = asamCosignOwnership(row.asam);
    expect(own.kind).toBe("owner");
    const signer = getStaffMember(own.kind === "owner" ? own.staffId : "")!;
    const work = myAsamWork({ role: signer.role, staffId: signer.id, staffName: signer.name, clinicianId: signer.clinicianId })!;
    expect(work.cosignsForMe.map(c => c.asamId)).toContain(asamId);
    expect(work.myDraftsAwaitingCosign.map(c => c.asamId)).not.toContain(asamId);
    // Rendered in "my-work-asam", which is not a waiting/today id → Needs you.
    expect(myWorkSource).toContain('data-testid="my-work-asam"');
    expect(waitingIds).not.toContain("my-work-asam");
  });

  it("is visible to exactly the roles that already saw this patient's ASAM rows", () => {
    const rolesSeeing = STAFF_ROLES.map(r => r.key).filter(r => (asamCosignRows(r) ?? []).some(c => c.asamId === asamId));
    expect(rolesSeeing).toEqual(rolesBefore);
    expect(rolesSeeing).not.toContain("clinical_coordinator");
    expect(rolesSeeing).not.toContain("ecm_provider");
  });
});
