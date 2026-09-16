// §Part 2 — the /my-work re-screen list must mask SUD instruments PER
// INSTRUMENT, exactly the way the chart's Tracking tab does: a consent_gated
// viewer still sees mental-health re-screens, and only sees AUDIT / DAST-10
// once that patient's SUD consent actually resolves for them.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { screenerDueRows } from "@/lib/myWork";
import { isPart2Screener } from "@/lib/screeners";

/**
 * The demo caseload does not happen to have a patient with both kinds of
 * re-screen prompted, so the test creates that state explicitly: one stale
 * mental-health screen (PHQ-9) and one stale SUD screen (AUDIT), both well
 * past the 30-day cadence step.
 */
const LONG_AGO = new Date(Date.now() - 200 * 86_400_000).toISOString();

function subject() {
  const p = AdelanteEHR.listPatients()[0]!;
  AdelanteEHR.recordScreener(p.id, {
    key: "phq-9",
    score: 8,
    severity: "mild",
    completedAt: LONG_AGO,
  });
  AdelanteEHR.recordScreener(p.id, {
    key: "audit",
    score: 6,
    severity: "low risk",
    completedAt: LONG_AGO,
  });
  const due = AdelanteEHR.rescreensDue(p.id);
  expect(due.some((d) => isPart2Screener(d.key))).toBe(true);
  expect(due.some((d) => !isPart2Screener(d.key))).toBe(true);
  return p;
}

function grantSud(patientId: string) {
  return AdelanteEHR.createConsentRecord({
    patientId,
    formType: "AB133",
    source: "test",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: "2020-01-01",
    sections: [
      { category: "sud_treatment", authorized: true },
      { category: "mental_health", authorized: true },
    ],
    capturedBy: { staffId: "s-cm1", staffName: "Luz Herrera", role: "ecm_provider" },
  });
}

describe("re-screen list SUD masking", () => {
  it("hides SUD instruments from a consent_gated role without consent, keeps MH rows", () => {
    const p = subject();
    for (const r of AdelanteEHR.listConsentRecords(p.id)) {
      if (r.status === "active")
        AdelanteEHR.revokeConsentRecord(r.id, { reason: "test reset", revokedBy: "test" });
    }
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(false);

    const gated = screenerDueRows([p], { role: "peer_specialist" });
    expect(gated.length).toBeGreaterThan(0);
    expect(gated.some((r) => isPart2Screener(r.screenerKey))).toBe(false);
    expect(gated.some((r) => !isPart2Screener(r.screenerKey))).toBe(true);

    // A treating clinician with straight `read` is unaffected.
    const clinician = screenerDueRows([p], { role: "therapist" });
    expect(clinician.some((r) => isPart2Screener(r.screenerKey))).toBe(true);
  });

  it("shows SUD instruments to the same role once consent is on file", () => {
    const p = subject();
    grantSud(p.id);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);

    const rows = screenerDueRows([p], { role: "peer_specialist" });
    expect(rows.some((r) => isPart2Screener(r.screenerKey))).toBe(true);
    expect(rows.some((r) => !isPart2Screener(r.screenerKey))).toBe(true);
  });
});
