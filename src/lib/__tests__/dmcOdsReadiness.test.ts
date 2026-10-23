// §Phase 10d-3 — medical necessity gate, CalOMS completeness, prototype export.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T15:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
// B2-5: load the registry so the approved demo treatment captures (runAction("consent_record_capture")) exist.
import "@/lib/actions/runAction";
import "@/lib/chartActions";
import { freshTestPatient } from "@/test/typedConsentCapture";
import { roleSeesAsam as roleSeesAsamB25 } from "@/lib/asamReporting";
import { setActingRole, setActingStaff, type StaffRole } from "@/lib/roles";
function actAs(role: string, staffId: string) {
  setActingStaff(staffId);
  setActingRole(role as StaffRole);
}
import {
  GATE_GENERIC_MESSAGE,
  calomsCompletenessFor,
  calomsWorklist,
  dmcOdsExportRows,
  exportDmcOdsCsv,
  gateMessageFor,
  medicalNecessityGate,
} from "@/lib/dmcOdsReadiness";
import { asamClinicalReport } from "@/lib/asamReporting";

const luis = () => demoScenarioPatientId("sud_consented")!;
const jasmine = () => demoScenarioPatientId("combination")!;
const treatmentClaim = (pid: string) =>
  AdelanteEHRExt.listClaims().find((c) => c.patientId === pid && c.program === "dmc_ods" && c.serviceCode !== "H0001")!;

describe("10d-3 medical necessity gate", () => {
  beforeEach(() => actAs("billing", "s-bill1"));

  it("Luis's treatment claim passes and can move to Ready", () => {
    const c = treatmentClaim(luis());
    expect(medicalNecessityGate(c)).toMatchObject({ applies: true, ok: true });
    expect(AdelanteEHRExt.transitionClaim(c.id, "generated")).toEqual({ ok: true });
  });

  it("Jasmine's claim is blocked with the generic line for billing, specific for a therapist", () => {
    const c = treatmentClaim(jasmine());
    const r = AdelanteEHRExt.transitionClaim(c.id, "generated");
    expect(r).toEqual({ ok: false, error: GATE_GENERIC_MESSAGE });
    expect(gateMessageFor("billing_coordinator", c)).toBe(GATE_GENERIC_MESSAGE);
    expect(gateMessageFor("therapist", c)).toMatch(/co-signature/);
    expect(c.state).toBe("coded");
  });

  it("H0001 and non-DMC-ODS claims are unaffected", () => {
    for (const c of AdelanteEHRExt.listClaims()) {
      if (c.serviceCode === "H0001" || c.program !== "dmc_ods") expect(medicalNecessityGate(c).applies).toBe(false);
    }
  });

  it("no signed ASAM → blocked; signed without SUD diagnosis → blocked", () => {
    const base = { patientId: "p3", encounterId: "x", program: "dmc_ods", serviceCode: "H0004", serviceDate: "2026-09-01" };
    expect(medicalNecessityGate(base)).toMatchObject({ ok: false, reason: "no_asam" });
    const p = AdelanteEHR.getPatient(luis())!;
    const saved = p.asamAssessments!.map((a) => a.diagnosisCodes);
    p.asamAssessments!.forEach((a) => (a.diagnosisCodes = ["F32.1"]));
    expect(medicalNecessityGate({ ...base, patientId: luis(), serviceDate: new Date().toISOString() })).toMatchObject({ ok: false, reason: "no_sud_dx" });
    p.asamAssessments!.forEach((a, i) => (a.diagnosisCodes = saved[i]));
  });
});

describe("10d-3 CalOMS completeness", () => {
  it("flags Marcus's incomplete discharge", () => {
    const c = calomsCompletenessFor(AdelanteEHR.getPatient("p3")!);
    expect(c.dischargeMissing).toContain("Other reason text");
    expect(calomsWorklist("therapist")!.some((r) => r.patientId === "p3")).toBe(true);
  });
  // Privacy P1: the clinical coordinator owns state reporting; billing stays excluded.
  it("is hidden for case manager and billing roles; visible for the state-reporting coordinator", () => {
    for (const r of ["ecm_provider", "billing", "billing_coordinator"] as const) {
      expect(calomsWorklist(r)).toBeNull();
    }
    expect(calomsWorklist("clinical_coordinator")).not.toBeNull();
  });
});

describe("10d-3 export", () => {
  it("returns no data for masked roles and audits authorized exports without values", () => {
    expect(dmcOdsExportRows("ecm_provider")).toBeNull();
    expect(dmcOdsExportRows("billing")).toBeNull();
    expect(exportDmcOdsCsv({ staffId: "s-bill1", role: "billing" })).toBeNull();
    // B2-5 ledger (tighten): the flag alone grants nothing; exported rows come only from typed treatment captures.
    const flagOnly = freshTestPatient("Dmc");
    flagOnly.consents.part2Sud = true;
    expect(roleSeesAsamB25("therapist", AdelanteEHR.getPatient(flagOnly.id))).toBe(false);
    const out = exportDmcOdsCsv({ staffId: "s-th1", role: "therapist" })!;
    expect(out.rowCount).toBeGreaterThan(0);
    expect(out.csv.split("\n")[0]).toMatch(/^Episode ID,/);
    const ev = AdelanteEHR.listAuditEvents().find((e) => e.action === "dmc_ods_export_downloaded")!;
    expect(ev.actorId).toBe("s-th1");
    expect(ev.detail).toEqual({ rowCount: out.rowCount, prototype: true });
  });
});

describe("coordinator totals only", () => {
  it("never receives a patient name", () => {
    const r = asamClinicalReport("clinical_coordinator")!;
    expect(r).toBeNull();
    expect(r?.cosign).toBeUndefined();
    expect(r?.differences).toBeUndefined();
  });
});
