import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { isSudMedication } from "@/lib/sudMedClassifier";
import { filterSudMedsForRole, roleSeesSudMedication } from "@/lib/asamReporting";
import { buildPrintRecordDocument } from "@/lib/printRecord";
import { listPatientOpenItems } from "@/lib/patientOpenItems";
import { isLateEntry } from "@/lib/noteRevisions";

describe("A1 SUD medication classifier + masking", () => {
  it("classifies the drug list and honours the clinician toggle", () => {
    for (const n of ["buprenorphine-naloxone", "Naltrexone 50 MG", "methadone", "acamprosate", "disulfiram", "Narcan nasal"])
      expect(isSudMedication({ name: n }), n).toBe(true);
    expect(isSudMedication({ drugName: "gabapentin" })).toBe(false);
    expect(isSudMedication({ drugName: "gabapentin", sudRelated: true })).toBe(true);
  });

  it("ECM, care manager, coordinator and billing never see Luis's buprenorphine", () => {
    const id = demoScenarioPatientId("sud_consented")!;
    const p = AdelanteEHR.getPatient(id)!;
    const meds = AdelanteEHR.listMedications(id);
    expect(meds.some((m) => isSudMedication(m))).toBe(true);
    for (const r of ["ecm_provider", "cf_care_manager", "clinical_coordinator", "billing", "billing_coordinator"] as const) {
      expect(roleSeesSudMedication(r, p), r).toBe(false);
      const { visible, hidden } = filterSudMedsForRole(meds, r, p);
      expect(visible.some((m) => isSudMedication(m))).toBe(false);
      expect(hidden).toBeGreaterThan(0);
      expect(JSON.stringify(listPatientOpenItems(id, r))).not.toMatch(/buprenorphine|suboxone/i);
    }
    expect(filterSudMedsForRole(meds, "pmhnp", p).hidden).toBe(0);
  });

  it("print export drops SUD orders for restricted roles", () => {
    const pid = AdelanteEHR.createPatient({ firstName: "Mask", lastName: "Print" } as never).id;
    AdelanteEHR.addDraftOrder(pid, { drugName: "Naltrexone 50 MG Oral Tablet" } as never);
    const all = AdelanteEHR.listOrders(pid);
    expect(all.length).toBe(1);
    const p = AdelanteEHR.getPatient(pid)!;
    expect(filterSudMedsForRole(all, "ecm_provider", p).visible).toHaveLength(0);
    const doc = buildPrintRecordDocument({ patient: p, role: "ecm_provider", flags: { meds: true } as never });
    expect(JSON.stringify(doc.sections)).not.toMatch(/naltrexone/i);
  });
});

function signedNote(patientId: string, hoursAgo = 2) {
  const start = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
  const n = AdelanteEHR.addProgressNote(patientId, {
    clinicianId: "c1",
    date: start,
    sessionType: "individual",
    subjective: "s",
    objective: "o",
    assessment: "a",
    plan: "p",
  })!;
  AdelanteEHR.signProgressNote(patientId, n.id, { signedBy: "Marisol Reyes", signedById: "c1", role: "therapist", attested: true, cosignRequired: false });
  return n.id;
}
const REYES = { byId: "c1", byName: "Marisol Reyes", role: "therapist" };
const find = (pid: string, id: string) => AdelanteEHR.getPatient(pid)!.progressNotes!.find((n) => n.id === id)!;

describe("A2 signed-note revisions", () => {
  const pid = () => AdelanteEHR.createPatient({ firstName: "Rev", lastName: "Note" } as never).id;

  it("addendum appends; original untouched; audited", () => {
    const p = pid();
    const id = signedNote(p);
    AdelanteEHR.addNoteAddendum(p, id, { ...REYES, text: "More detail" });
    const n = find(p, id);
    expect(n.addenda).toHaveLength(1);
    expect(n.subjective).toBe("s");
    expect(n.revisionLog?.[0]?.action).toBe("addendum");
  });

  it("amend: author only, reason required, prior version superseded", () => {
    const p = pid();
    const id = signedNote(p);
    expect(() => AdelanteEHR.amendProgressNote(p, id, { ...REYES, changes: { plan: "x" }, reason: "" })).toThrow(/reason/);
    expect(() =>
      AdelanteEHR.amendProgressNote(p, id, { byId: "c9", byName: "Someone Else", role: "therapist", changes: { plan: "x" }, reason: "fix it" }),
    ).toThrow(/author/);
    AdelanteEHR.amendProgressNote(p, id, { ...REYES, changes: { plan: "new plan" }, reason: "typo" });
    const n = find(p, id);
    expect(n.plan).toBe("new plan");
    expect(n.version).toBe(2);
    expect(n.priorVersions?.[0]?.plan).toBe("p");
  });

  it("void needs an approver who is not the author", () => {
    const p = pid();
    const id = signedNote(p);
    AdelanteEHR.requestNoteVoid(p, id, { ...REYES, reason: "wrong chart" });
    expect(() => AdelanteEHR.decideNoteVoid(p, id, { approve: true, clinicianId: "c1", name: "Marisol Reyes", role: "therapist" })).toThrow();
    AdelanteEHR.decideNoteVoid(p, id, { approve: true, staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" });
    const n = find(p, id);
    expect(n.voidedAt).toBeTruthy();
    expect(() => AdelanteEHR.addNoteAddendum(p, id, { ...REYES, text: "late" })).toThrow(/voided/);
  });

  it("late entry: > 24 h (draft) after the visit", () => {
    expect(isLateEntry("2026-09-01T10:00:00Z", "2026-09-02T10:00:01Z")).toBe(true);
    expect(isLateEntry("2026-09-01T10:00:00Z", "2026-09-02T09:00:00Z")).toBe(false);
    const p = pid();
    expect(find(p, signedNote(p, 30)).lateEntry).toBeTruthy();
    expect(find(p, signedNote(p, 2)).lateEntry).toBeUndefined();
  });

  it("demo: corrected note flags its claim; voided note blocks its claim", () => {
    const claims = AdelanteEHRExt.listClaims();
    expect(claims.some((c) => c.reviewFlag?.label === "Clinical documentation corrected — review claim")).toBe(true);
    expect(claims.some((c) => c.voidBlocked && c.reviewFlag?.kind === "note_voided")).toBe(true);
  });
});

describe("A3 demographics", () => {
  it("reason for CIN, history kept, contact-only for primary clinician, eligibility flag", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Demo", lastName: "Graph" } as never);
    const coord = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" as const };
    expect(() => AdelanteEHR.updatePatientDemographics(p.id, { cin: "99999999Z" }, coord)).toThrow(/reason/);
    AdelanteEHR.updatePatientDemographics(p.id, { cin: "99999999Z" }, coord, "card correction");
    const after = AdelanteEHR.getPatient(p.id)!;
    expect(after.cin).toBe("99999999Z");
    expect(after.demographicsHistory?.[0]?.changes[0]?.before).toBe("");
    expect(after.eligibilityRecheck?.fields).toEqual(["cin"]);
    expect(() =>
      AdelanteEHR.updatePatientDemographics(p.id, { firstName: "X" }, { name: "Darnell Pope", role: "cf_care_manager" }),
    ).toThrow();
  });
});
