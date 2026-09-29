import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import "@/lib/ehr-ext";
import { findAllergyMatches, requiresCuresCheck } from "@/lib/orderSafety";
import {
  activeEpisode,
  advanceHlocReferral,
  createHlocReferral,
  dischargeEpisode,
  episodeHeaderLabel,
  listEpisodes,
  openEpisode,
  readmit,
  recordLegalDisclosureConsent,
  visibleHlocReferrals,
} from "@/lib/outpatientCare";

const TH = { name: "Marisol Reyes", role: "therapist" };
let n = 0;
const fresh = () => AdelanteEHR.createPatient({ firstName: "B", lastName: `T${++n}`, dob: "1990-01-01" } as never);

describe("turn B", () => {
  it("allergy: ingredient and class matches", () => {
    const al = [{ substance: "Penicillin", active: true }];
    expect(findAllergyMatches({ drugName: "Penicillin VK" }, al)[0]?.kind).toBe("ingredient");
    expect(findAllergyMatches({ drugName: "Amoxicillin 500 MG" }, al)[0]?.kind).toBe("class");
    expect(findAllergyMatches({ drugName: "Sertraline" }, al)).toHaveLength(0);
  });
  it("signing blocks: no allergies → NKDA; allergy match → override; CURES for CIV/MOUD", () => {
    const p = fresh();
    const o = AdelanteEHR.addDraftOrder(p.id, { drugName: "Lorazepam 0.5 MG", ingredientNames: ["lorazepam"] } as never);
    const sign = () => AdelanteEHR.signOrders(p.id, [o.id], "Dr. M. Bagga", { actorRole: "pmhnp" });
    expect(sign).toThrow(/Allergies not recorded/);
    AdelanteEHR.addAllergy(p.id, { substance: "Benzodiazepines", severity: "moderate", enteredBy: "t" });
    expect(sign).toThrow(/Allergy warning/);
    expect(() => AdelanteEHR.overrideOrderAllergy(p.id, o.id, { reason: "", by: "x", role: "pmhnp" })).toThrow(/reason/);
    AdelanteEHR.overrideOrderAllergy(p.id, o.id, { reason: "Benefit outweighs risk", by: "Dr. M. Bagga", role: "pmhnp" });
    expect(sign).toThrow(/CURES/);
    expect(() => AdelanteEHR.recordCuresCheck(p.id, o.id, { checkedAt: "2026-09-27T10:00", result: "no_concerns", by: "t", role: "therapist" })).toThrow(/prescriber/);
    expect(() => AdelanteEHR.recordCuresCheck(p.id, o.id, { checkedAt: "2026-09-27T10:00", result: "unable_to_access", by: "b", role: "pmhnp" })).toThrow(/reason/);
    AdelanteEHR.recordCuresCheck(p.id, o.id, { checkedAt: "2026-09-27T10:00", result: "no_concerns", by: "Dr. M. Bagga", role: "pmhnp" });
    expect(sign()).toHaveLength(1);
    expect(requiresCuresCheck({ drugName: "Naltrexone 50 MG" })).toBe(false);
    expect(requiresCuresCheck({ drugName: "Acamprosate 333 MG" })).toBe(false);
    expect(requiresCuresCheck({ drugName: "Disulfiram 250 MG" })).toBe(false);
    expect(requiresCuresCheck({ drugName: "Buprenorphine 8 MG" })).toBe(true);
    expect(requiresCuresCheck({ drugName: "Lorazepam 1 MG" })).toBe(true);
    const log = AdelanteEHR.listAuditEvents?.() ?? [];
    expect(JSON.stringify(log)).toMatch(/order_allergy_override/);
  });
  it("episodes: open, discharge (reason + summary), readmit keeps history; SUD masked for ECM", () => {
    const p = fresh();
    openEpisode({ patientId: p.id, program: "outpatient_sud", actor: TH });
    expect(episodeHeaderLabel(p.id, "ecm_provider")).toBe("Active in Adelante care");
    expect(() => dischargeEpisode({ patientId: p.id, reason: "completed", summary: "", actor: TH, confirmCancelVisits: true })).toThrow(/summary/);
    dischargeEpisode({ patientId: p.id, reason: "completed", summary: "Met all treatment goals.", actor: TH, confirmCancelVisits: true });
    expect(activeEpisode(p.id)).toBeUndefined();
    readmit({ patientId: p.id, actor: TH });
    expect(listEpisodes(p.id)).toHaveLength(2);
    expect(activeEpisode(p.id)?.readmitOf).toBeTruthy();
  });
  it("HLOC referral: outside SUD send blocked without Part 2 disclosure consent; masked for ECM", () => {
    const p = fresh();
    const r = createHlocReferral({ patientId: p.id, target: "residential", reason: "Needs 24h structure", urgency: "urgent", destination: "Outside Recovery", outsideSudProvider: true, actor: TH });
    expect(() => advanceHlocReferral(r.id, "sent", TH)).toThrow(/Part 2 disclosure consent/);
    recordLegalDisclosureConsent(p.id, TH, "B T");
    expect(advanceHlocReferral(r.id, "sent", TH).status).toBe("sent");
    expect(visibleHlocReferrals("ecm_provider", p.id)).toHaveLength(0);
    expect(visibleHlocReferrals("therapist", p.id)).toHaveLength(1);
  });
  it("void queue shows metadata only; reject needs a reason", () => {
    const priya = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" };
    const rows = AdelanteEHR.listPendingNoteVoids(priya);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.title).toMatch(/^Void request — progress note — /);
    expect(JSON.stringify(rows[0])).not.toMatch(/subjective|Demo note/);
    expect(() => AdelanteEHR.decideNoteVoid(rows[0]!.patientId, rows[0]!.noteId, { approve: false, ...priya })).toThrow(/reason/);
  });
});
