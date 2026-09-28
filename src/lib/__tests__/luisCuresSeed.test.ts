import { describe, it, expect } from "vitest";
import { demoScenarioPatientId, AdelanteEHR } from "@/lib/ehr";

// Demo sweep: Luis's chart must show buprenorphine with its CURES record.
describe("Luis demo CURES order", () => {
  it("has a signed buprenorphine order with a CURES check", () => {
    const id = demoScenarioPatientId("sud_consented");
    expect(id).toBeTruthy();
    const o = AdelanteEHR.getPatient(id!)?.orders?.find((x) => /buprenorphine/i.test(x.drugName));
    expect(o?.status).toBe("signed");
    expect(o?.curesCheck?.result).toBe("no_concerns");
  });
});
