import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "../ehr";
import { _resetHieForTests, hieChartView, listHeldHieRecords, releaseHeldHieRecord, runSimulatedHieSync } from "../hie";
import { _resetDataExchangeForTests, confirmMatch, disclosureCsv, listIncomingEvents, listMatchQueue, rejectMatch, seedDataExchangeDemo } from "../dataExchange";
import { resolveNavAccess } from "../navGuard";
import { STAFF_ROLES } from "../roles";

const pid = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n)!.id;
const admin = { name: "Priya", role: "clinical_coordinator" };

describe("data exchange hub", () => {
  beforeEach(() => { _resetHieForTests(); _resetDataExchangeForTests(); runSimulatedHieSync(); seedDataExchangeDemo(); });

  it("only sys_admin and clinical_coordinator can open the route", () => {
    for (const { key } of STAFF_ROLES) {
      const s = resolveNavAccess(key, "/data-exchange").status;
      expect(s).toBe(key === "sys_admin" || key === "clinical_coordinator" ? "allowed" : "denied");
    }
  });

  it("unmatched records stay off charts until confirmed; reject needs a reason", () => {
    const luis = pid("Luis");
    expect(hieChartView(luis, "therapist").encounters).toHaveLength(0);
    confirmMatch("match-luis", admin);
    expect(hieChartView(luis, "therapist").encounters).toHaveLength(1);
    expect(() => rejectMatch("match-dmartinez", " ", admin)).toThrow();
    rejectMatch("match-dmartinez", "Different person", admin);
    expect(listMatchQueue()).toHaveLength(0);
  });

  it("held Part 2 record is released only after consent", () => {
    const j = pid("Jordan");
    const held = listHeldHieRecords().find((h) => h.patientId === j)!;
    expect(held).toBeTruthy();
    expect(hieChartView(j, "therapist").encounters.some((e) => e.sud)).toBe(false);
    expect(() => releaseHeldHieRecord(held.id, admin)).toThrow();
    AdelanteEHR.setConsent(j, "part2Sud", true);
    releaseHeldHieRecord(held.id, admin);
    expect(listHeldHieRecords().some((h) => h.id === held.id)).toBe(false);
    expect(hieChartView(j, "physician").encounters.some((e) => e.id === held.id)).toBe(true);
  });

  it("events list shows an overdue item and masks SUD for restricted roles", () => {
    expect(listIncomingEvents("clinical_coordinator").some((x) => x.followUp === "overdue")).toBe(true);
    expect(listIncomingEvents("case_manager" as never).some((x) => x.encounter.sud)).toBe(false);
  });

  it("exports a patient's disclosure list", () => {
    const csv = disclosureCsv(pid("Rosa"), admin);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toMatch(/Summary of care/);
  });
});

describe("Part 2 toggle on an existing consent record", () => {
  it("authorizes sud_treatment when an active record lacks it", () => {
    const p = AdelanteEHR.listPatients().find((x) => !AdelanteEHR.isConsentCategoryAuthorized(x.id, "sud_treatment") && AdelanteEHR.activeConsentRecord(x.id));
    if (!p) return;
    AdelanteEHR.setConsent(p.id, "part2Sud", true);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);
  });
});
