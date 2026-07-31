// §Admin governance — frequency catalog CRUD + in-use protection, local
// RxNav suppressions, and off-catalog reuse.
import { describe, expect, it, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resetFrequencyCatalog, frequencyByCode, listFrequencies } from "@/lib/frequencies";
import { applySuppressions, matchSuppression } from "@/lib/catalogSuppressions";

const ADMIN = "Christi Ruiz";

describe("frequency catalog admin", () => {
  beforeEach(() => resetFrequencyCatalog());

  it("creates a scheduled frequency and exposes it to the picker", () => {
    AdelanteEHR.saveFrequency(
      { code: "q3h", label: "Q3H — every 3 hours", sigLabel: "every 3 hours", isPrn: false, adminTimes: [6, 9, 12] },
      ADMIN,
    );
    const row = frequencyByCode("Q3H")!;
    expect(row.adminTimes).toEqual([6, 9, 12]);
    expect(listFrequencies().some((f) => f.code === "Q3H")).toBe(true);
  });

  it("rejects invalid admin times and empty scheduled grids", () => {
    expect(() =>
      AdelanteEHR.saveFrequency(
        { code: "BAD", label: "x", sigLabel: "x", isPrn: false, adminTimes: [25] },
        ADMIN,
      ),
    ).toThrow(/between 0 and 23/i);
    expect(() =>
      AdelanteEHR.saveFrequency(
        { code: "BAD2", label: "x", sigLabel: "x", isPrn: false, adminTimes: [] },
        ADMIN,
      ),
    ).toThrow(/at least one administration time/i);
  });

  it("deletes an unused frequency but blocks one in use, offering deactivate", () => {
    AdelanteEHR.saveFrequency(
      { code: "Q3H", label: "Q3H", sigLabel: "every 3 hours", isPrn: false, adminTimes: [6] },
      ADMIN,
    );
    AdelanteEHR.deleteFrequency("Q3H", ADMIN);
    expect(frequencyByCode("Q3H")).toBeUndefined();

    // Put a signed order on BID, then try to delete it.
    const patientId = AdelanteEHR.listPatients()[0].id;
    const draft = AdelanteEHR.addDraftOrder(patientId, {
      drugName: "sertraline 50 MG Oral Tablet",
      frequencyCode: "BID",
      createdBy: ADMIN,
    });
    AdelanteEHR.signOrders(patientId, [draft.id], "Dr. R. Bagga");

    expect(AdelanteEHR.frequencyUsage("BID").count).toBeGreaterThan(0);
    expect(() => AdelanteEHR.deleteFrequency("BID", ADMIN)).toThrow(/cannot be deleted/i);
    expect(frequencyByCode("BID")).toBeDefined();

    expect(() => AdelanteEHR.setFrequencyActive("BID", false, ADMIN, "  ")).toThrow(
      /reason is required/i,
    );
    AdelanteEHR.setFrequencyActive("BID", false, ADMIN, "replaced by Q12H");
    expect(listFrequencies().some((f) => f.code === "BID")).toBe(false);
    // Historical orders still resolve the label.
    expect(frequencyByCode("BID")?.deactivatedReason).toBe("replaced by Q12H");

    AdelanteEHR.setFrequencyActive("BID", true, ADMIN);
    expect(listFrequencies().some((f) => f.code === "BID")).toBe(true);
  });

  it("audits every frequency transition", () => {
    AdelanteEHR.saveFrequency(
      { code: "Q3H", label: "Q3H", sigLabel: "every 3 hours", isPrn: false, adminTimes: [6] },
      ADMIN,
    );
    AdelanteEHR.setFrequencyActive("Q3H", false, ADMIN, "not stocked");
    const actions = AdelanteEHR.listAuditEvents({})
      .filter((e) => JSON.stringify(e.detail ?? {}).includes("Q3H"))
      .map((e) => e.action);
    expect(actions).toContain("frequency_created");
    expect(actions).toContain("frequency_deactivated");
  });
});

describe("local RxNav suppressions", () => {
  it("requires a reason and matches by name or rxcui", () => {
    expect(() => AdelanteEHR.addCatalogSuppression({ drugName: "carisoprodol", reason: " " }, ADMIN)).toThrow(
      /reason is required/i,
    );
    const rule = AdelanteEHR.addCatalogSuppression(
      { drugName: "carisoprodol", reason: "not on formulary" },
      ADMIN,
    );
    const rules = AdelanteEHR.listCatalogSuppressions();
    const products = [
      { rxcui: "1", name: "carisoprodol 350 MG Oral Tablet" },
      { rxcui: "2", name: "sertraline 50 MG Oral Tablet" },
    ];
    const { visible, suppressed } = applySuppressions(products, rules);
    expect(visible.map((p) => p.rxcui)).toEqual(["2"]);
    expect(suppressed[0].rule.reason).toBe("not on formulary");

    expect(() =>
      AdelanteEHR.addCatalogSuppression({ drugName: "Carisoprodol", reason: "dup" }, ADMIN),
    ).toThrow(/already covers/i);

    expect(() => AdelanteEHR.setCatalogSuppressionActive(rule.id, false, ADMIN, "")).toThrow(
      /reason is required/i,
    );
    AdelanteEHR.setCatalogSuppressionActive(rule.id, false, ADMIN, "now stocked");
    expect(AdelanteEHR.listCatalogSuppressions().some((s) => s.id === rule.id)).toBe(false);
    // Never deleted — still there with includeInactive.
    expect(AdelanteEHR.listCatalogSuppressions(true).some((s) => s.id === rule.id)).toBe(true);
    expect(matchSuppression(products[0], AdelanteEHR.listCatalogSuppressions())).toBeUndefined();
  });
});

describe("off-catalog reuse", () => {
  it("lists distinct off-catalog product names already ordered", () => {
    const patientId = AdelanteEHR.listPatients()[0].id;
    AdelanteEHR.addDraftOrder(patientId, {
      drugName: "Adelante house multivitamin",
      offCatalog: true,
      offCatalogJustification: "house-stocked, not in RxNorm",
      createdBy: ADMIN,
    });
    const names = AdelanteEHR.listOffCatalogProducts().map((p) => p.name);
    expect(names).toContain("Adelante house multivitamin");
  });
});