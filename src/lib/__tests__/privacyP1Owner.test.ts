import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { _resetCountyReporting, generateReport, setTpsWindow, tpsList } from "@/lib/countyReporting";
import { exportDmcOdsCsv } from "@/lib/dmcOdsReadiness";

const coord = { role: "clinical_coordinator" as const, name: "Clinical coordinator", staffId: "s-cc-p1" };
const disclosureEvents = () => AdelanteEHR.listAuditEvents({ category: "disclosure" });

beforeEach(() => {
  _resetCountyReporting();
  setTpsWindow({ role: "sys_admin", name: "Admin" }, { start: "2000-01-01", end: "2100-01-01" });
});

describe("Privacy P1 — clinical coordinator owns state SUD reporting", () => {
  it("generates the CalOMS file and every checked patient writes a disclose() audit entry", () => {
    const before = disclosureEvents().length;
    const s = generateReport(coord, "caloms", "30");
    expect(s.file).toContain("#");
    expect(s.disclosureChecks).toBeGreaterThan(0);
    expect(disclosureEvents().length - before).toBe(s.disclosureChecks);
  });
  it("the DMC-ODS export goes through disclose() with an audit entry", () => {
    const before = disclosureEvents().length;
    const out = exportDmcOdsCsv({ staffId: coord.staffId, role: coord.role, name: coord.name });
    expect(out).not.toBeNull();
    expect(disclosureEvents().length).toBeGreaterThan(before);
  });
  it("can use tps_mark and tps_send_link", () => {
    const pid = tpsList("clinical_coordinator")?.[0]?.patientId;
    expect(pid).toBeTruthy();
    const p = AdelanteEHR.getPatient(pid!)!;
    const actor = { role: coord.role, staffId: coord.staffId, staffName: coord.name };
    expect(runAction("tps_mark", actor, p, { args: [coord, pid, "offered"] }).ok).toBe(true);
    expect(runAction("tps_send_link", actor, p, { args: [coord, pid] }).ok).toBe(true);
  });
  it("billing roles cannot generate CalOMS, export DMC-ODS or use TPS actions", () => {
    for (const role of ["billing", "billing_coordinator"] as const) {
      expect(() => generateReport({ role, name: "x" }, "caloms", "30")).toThrow();
      expect(exportDmcOdsCsv({ staffId: "s-x", role, name: "x" })).toBeNull();
      expect(tpsList(role)).toBeNull();
      const actor = { role, staffId: "s-x", staffName: "x" };
      expect(runAction("tps_mark", actor, undefined as never, { args: [{ role, name: "x" }, "p1", "offered"] }).ok).toBe(false);
      expect(runAction("tps_send_link", actor, undefined as never, { args: [{ role, name: "x" }, "p1"] }).ok).toBe(false);
    }
  });
});
