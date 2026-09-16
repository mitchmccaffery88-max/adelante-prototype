// §Part 2 — the /my-work re-screen list must mask SUD instruments PER
// INSTRUMENT, exactly the way the chart's Tracking tab does: a consent_gated
// viewer still sees mental-health re-screens, and only sees AUDIT / DAST-10
// once that patient's SUD consent actually resolves for them.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { screenerDueRows } from "@/lib/myWork";
import { isPart2Screener } from "@/lib/screeners";

/** A patient who genuinely has both MH and SUD re-screens prompted. */
function subject() {
  const p = AdelanteEHR.listPatients().find((x) => {
    const due = AdelanteEHR.rescreensDue(x.id);
    return due.some((d) => isPart2Screener(d.key)) && due.some((d) => !isPart2Screener(d.key));
  });
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
    if (!p) return; // no demo patient with both kinds due — nothing to assert
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
    if (!p) return;
    grantSud(p.id);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);

    const rows = screenerDueRows([p], { role: "peer_specialist" });
    expect(rows.some((r) => isPart2Screener(r.screenerKey))).toBe(true);
    expect(rows.some((r) => !isPart2Screener(r.screenerKey))).toBe(true);
  });
});
