// §B2-5 — consent migration (Mitch, Oct 23). Flags and unproven pre-B2
// records grant nothing; only the listed demo needs are re-captured as signed
// typed records through the real registry action. Draft — pending counsel.
// Real clock: the seed captures are signed at module load, never backdated.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import "@/lib/actions/runAction";
import { migrateUnprovenConsents, seedConsentMigration } from "@/lib/consentMigration";
import { seedOutpatientCareDemo } from "@/lib/outpatientCare";
import { PARTNER_CLUSTERS } from "@/lib/carePartners";
import { coordinatorConsentedPatients } from "@/lib/asamReporting";
import { publishedForm } from "@/lib/consentForms";
import { validateEntry, type DeltaEntry } from "@/test/b25ExpectedDelta";

const byName = (first: string, last?: string) => {
  const p = AdelanteEHR.listPatients().find((x) => x.firstName === first && (!last || x.lastName === last));
  if (!p) throw new Error(`missing ${first}`);
  return p;
};
const typed = (pid: string) => AdelanteEHR.listConsentRecords(pid).filter((r) => r.consentType);
const SYS = { role: "sys_admin" as const, staffId: "s-admin1", name: "Adelante System Admin" };

describe("B2-5 consent migration", () => {
  it("flag-only patients are denied: the flag is still set but grants nothing", () => {
    for (const [f, l] of [["Alicia", "Serrano"], ["Alicia", "R."], ["Marcus", "Whitfield"], ["Lucía", "Moreno"]]) {
      const p = byName(f, l);
      expect(p.consents.part2Sud).toBe(true);
      expect(typed(p.id)).toHaveLength(0);
      expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(false);
      expect(AdelanteEHR.getConsentState(p.id).part2Sud).toBe(false);
    }
  });

  it("Daniel's unproven records are legacyUnverified and grant nothing beyond the one signed partner scope", () => {
    const untyped = AdelanteEHR.listConsentRecords("p1").filter((r) => !r.consentType);
    expect(untyped.length).toBeGreaterThan(0);
    expect(untyped.every((r) => r.legacyUnverified === true)).toBe(true);
    expect(AdelanteEHR.activeConsentRecord("p1")).toBeUndefined();
    for (const c of ["sud_treatment", "mental_health", "case_coordination", "legal_disclosure"] as const)
      expect(AdelanteEHR.isConsentCategoryAuthorized("p1", c)).toBe(false);
    const t = typed("p1");
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ consentType: "legal_part2_disclosure", purpose: "Reentry coordination", items: [...PARTNER_CLUSTERS.outreach.slice] });
    expect(t[0].recipients).toEqual([{ kind: "org", name: "Porterville Community Resource Center (fictional)" }]);
    expect(t[0].signature).toMatchObject({ method: "e_sign", signer: "Daniel M.", relationship: "patient" });
    expect(t[0].document?.formKey).toBe("part2_named_org");
    expect(t[0].document?.versionId).toBe(publishedForm("part2_named_org")?.id);
    expect(AdelanteEHR.consentCovers("p1", { type: "legal_part2_disclosure", recipient: "Outside Clinic", purpose: "Reentry coordination" })).toBe(false);
  });

  it("re-captures Marcus L., Luis Camacho and Jasmine Holt as treatment-only program records, nothing else", () => {
    for (const [f, l] of [["Marcus", "L."], ["Luis", "Camacho"], ["Jasmine", "Holt"]]) {
      const p = byName(f, l);
      const t = typed(p.id);
      expect(t).toHaveLength(1);
      expect(t[0]).toMatchObject({ consentType: "part2_tpo_single", purpose: "treatment", purposeCode: "treatment", items: ["SUD treatment information"] });
      expect(t[0].recipients).toEqual([{ kind: "org", name: "Adelante", directoryRef: "adelante-program" }]);
      expect(t[0].signature).toMatchObject({ method: "e_sign", signer: `${p.firstName} ${p.lastName}`, relationship: "patient" });
      // Never backdated: signed when it was recorded.
      expect(t[0].signature?.signedAt).toBe(t[0].signature?.recordedAt);
      expect(t[0].document?.versionId).toBe(publishedForm("part2")?.id);
      expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);
      expect(AdelanteEHR.consentCovers(p.id, { type: "part2_tpo_single", recipient: "adelante-program", purpose: "care_coordination" })).toBe(false);
    }
  });

  it("Jordan: one Tulare Recovery House record for the actual outbound purpose and item", () => {
    seedOutpatientCareDemo();
    const j = byName("Jordan", "Vega");
    const t = typed(j.id);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ consentType: "legal_part2_disclosure", purpose: "Referral for treatment", items: ["SUD referral information"] });
    expect(t[0].recipients).toEqual([{ kind: "org", name: "Tulare Recovery House (residential, demo)" }]);
  });

  it("no counseling release or care-coordination grant exists; the coordinator cohort stays empty; Victor and Tomás have no re-capture", () => {
    const all = AdelanteEHR.listPatients().flatMap((p) => typed(p.id));
    expect(all.some((r) => r.consentType === "counseling_notes_release")).toBe(false);
    expect(all.some((r) => r.purposeCode === "care_coordination" || r.purpose === "care_coordination")).toBe(false);
    expect(coordinatorConsentedPatients()).toEqual([]);
    for (const first of ["Victor", "Tomás"]) {
      const p = AdelanteEHR.listPatients().find((x) => x.firstName === first);
      if (p) expect(typed(p.id)).toHaveLength(0);
    }
  });

  it("is idempotent: re-running the migration adds no records and no audits", () => {
    const records = AdelanteEHR.listPatients().reduce((n, p) => n + AdelanteEHR.listConsentRecords(p.id).length, 0);
    const audits = AdelanteEHR.listAuditEvents({ category: "consent" }).length;
    seedConsentMigration();
    seedConsentMigration();
    expect(AdelanteEHR.listPatients().reduce((n, p) => n + AdelanteEHR.listConsentRecords(p.id).length, 0)).toBe(records);
    expect(AdelanteEHR.listAuditEvents({ category: "consent" }).length).toBe(audits);
  });

  it("refuses invented provenance and non-admin migration", () => {
    expect(() => migrateUnprovenConsents({ patientId: "p1", verify: true, actor: SYS })).toThrow(/cannot invent/);
    expect(() => migrateUnprovenConsents({ patientId: "p1", actor: { ...SYS, role: "therapist" as never } })).toThrow(/Only sys_admin/);
    expect(AdelanteEHR.listConsentRecords("p1").filter((r) => !r.consentType).every((r) => r.legacyUnverified)).toBe(true);
  });

  it("the expected-delta adapter refuses widening and unlisted transforms", () => {
    const e = (over: Partial<DeltaEntry>): DeltaEntry => ({ transform: "i", patient: "Alicia Serrano", path: ["x"], op: "set", before: true, after: false, ...over });
    expect(() => validateEntry(e({}))).not.toThrow();
    expect(() => validateEntry(e({ before: false, after: true }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ before: "0100", after: "1100" }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ before: "ecm_provider:read:101", after: "ecm_provider:write:101" }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ patient: "Rosa T." }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ transform: "iii", patient: "Marcus L.", before: "Consent record abc", after: "Consent record b25new01" }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ transform: "ii", before: "no:x", after: "Consent record y" }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ transform: "iv", path: ["consentAuditCount"], before: 11, after: 16, events: ["a", "b", "c", "d"] }))).toThrow(/STOP/);
    expect(() => validateEntry(e({ transform: "v" as never }))).toThrow(/STOP/);
  });
});
