import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess, getStaffMember, isPrescriberRole, STAFF_ROLES } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { chartAction } from "@/lib/chartActions";
import { administerClinicDose, cosignClinicDose, dosesFor, nurseQueue, nurseReviewFor, nurseReviewOrder, orderClinicMedication, recordTriageCall } from "@/lib/nursing";
import { linkPartner, listPartnerOrgs, recordHandoff, visiblePartnerLinks, DEMO_NTP_ID, PARTNER_CLUSTERS } from "@/lib/carePartners";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { recordLegalDisclosureConsent } from "@/lib/outpatientCare";
import { METHADONE_NTP_MESSAGE } from "@/lib/methadoneGuard";
import { recordExternalNtpMedication, referToNtp } from "@/lib/ntpReferral";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { ASAM_AUTHOR_ROLES } from "@/lib/asam";
import { COUNTY_INTERIM_PREPARER_LABEL, COUNTY_INTERIM_PREPARER_ROLE, COUNTY_REPORTING_ROLES } from "@/lib/countyReporting";
import { REFILL_PRESCRIBER_ROLES } from "@/lib/ehr";

const staff = (id: string) => {
  const s = getStaffMember(id)!;
  return { role: s.role, staffId: s.id, name: s.name };
};
const RN = () => staff("s-rn1");
const LVN = () => staff("s-lvn1");
const patients = () => AdelanteEHR.listPatients();
const doc = () => {
  const s = getStaffMember("s-np1")!;
  return { role: s.role, staffId: s.id, name: s.name };
};
function newOrder(pid = patients()[1].id) {
  return orderClinicMedication({ patientId: pid, drugName: "Hydroxyzine 25 MG Oral Tablet", dose: "25 mg", route: "PO", actor: doc(), enforceSafety: false });
}

describe("E1 nurse and LVN roles", () => {
  it("are registered with seeded staff and credentials", () => {
    expect(STAFF_ROLES.map((r) => r.key)).toEqual(expect.arrayContaining(["nurse_rn", "lvn"]));
    expect(RN().role).toBe("nurse_rn");
    expect(LVN().role).toBe("lvn");
    expect(AdelanteEHR.listClinicians().find((c) => c.id === "c-rn1")?.services).toEqual([]);
  });
  it("never prescribe, sign ASAM, or see therapy notes", () => {
    for (const r of ["nurse_rn", "lvn"] as const) {
      expect(isPrescriberRole(r)).toBe(false);
      expect(REFILL_PRESCRIBER_ROLES.includes(r as never)).toBe(false);
      expect(ASAM_AUTHOR_ROLES.includes(r as never)).toBe(false);
      expect(canAccess(r, "therapy_notes").level).toBe("none");
      expect(canAccess(r, "psychotherapy_notes").level).toBe("none");
      expect(canAccess(r, "psych_eval").level).toBe("none");
      expect(chartAction("med_order").allowed({ role: r }).state).toBe("hidden");
      expect(chartAction("clinic_med_order").allowed({ role: r }).state).toBe("hidden");
      expect(chartAction("progress_note").allowed({ role: r }).state).toBe("hidden");
    }
    expect(canAccess("nurse_rn", "screeners_sud").level).toBe("read");
  });
  it("runs the chain prescriber → RN review → LVN gives → RN cosigns, visible in each next Needs my action", () => {
    const o = newOrder();
    expect(nurseQueue({ role: "nurse_rn", staffId: "s-rn1" }).some((r) => r.orderId === o.id && r.kind === "review")).toBe(true);
    expect(() => administerClinicDose({ patientId: o.patientId, orderId: o.id, actor: LVN() })).toThrow(/verify/);
    const p = AdelanteEHR.getPatient(o.patientId);
    const rv = runAction("nurse_review", RN(), p, { args: [{ patientId: o.patientId, orderId: o.id, decision: "verified", actor: RN() }] });
    expect(rv.ok).toBe(true);
    expect(nurseReviewFor(o.id)?.decision).toBe("verified");
    expect(nurseQueue({ role: "lvn", staffId: "s-lvn1" }).some((r) => r.orderId === o.id && r.kind === "administer")).toBe(true);
    const give = runAction("clinic_dose_give", LVN(), p, { args: [{ patientId: o.patientId, orderId: o.id, actor: LVN() }] });
    expect(give.ok && give.outcome).toBe("cosign_routed");
    const d = dosesFor(o.id)[0];
    expect(d.supervisorStaffId).toBe("s-rn1");
    expect(nurseQueue({ role: "nurse_rn", staffId: "s-rn1" }).some((r) => r.doseId === d.id && r.kind === "cosign")).toBe(true);
    cosignClinicDose({ doseId: d.id, actor: RN() });
    expect(dosesFor(o.id)[0].cosign?.status).toBe("signed");
  });
  it("blocks LVN review and LVN triage in the store and the registry", () => {
    const o = newOrder();
    expect(() => nurseReviewOrder({ patientId: o.patientId, orderId: o.id, decision: "verified", actor: LVN() })).toThrow(/RN only/);
    const r = runAction("nurse_review", LVN(), AdelanteEHR.getPatient(o.patientId), { args: [] });
    expect(r.ok).toBe(false);
    expect(() => recordTriageCall({ patientId: o.patientId, concern: "Dizzy", disposition: "self_care", actor: LVN() })).toThrow();
  });
});

describe("F1 methadone guard", () => {
  it("blocks outpatient methadone orders and prescriptions with the exact message", () => {
    const pid = patients()[0].id;
    expect(() => AdelanteEHR.addDraftOrder(pid, { drugName: "Methadone HCl 10 MG Oral Tablet", createdBy: "x" } as never)).toThrow(METHADONE_NTP_MESSAGE);
    expect(() => AdelanteEHR.prescribeMedication({ patientId: pid, name: "Methadone 10 mg", dose: "10", route: "PO", frequency: "daily", prescriber: "x", startedOn: "2026-01-01" } as never)).toThrow(METHADONE_NTP_MESSAGE);
    expect(METHADONE_NTP_MESSAGE).toBe("Methadone for opioid use disorder can only be dispensed by a certified Narcotic Treatment Program (NTP).");
  });
  it("offers an NTP referral and an outside-NTP reconciliation entry that is not an order", () => {
    const p = patients().find((x) => roleSeesAsamSection("physician", x))!;
    const before = AdelanteEHR.listOrders(p.id).length;
    const res = referToNtp({ patientId: p.id, reason: "OUD — needs methadone", actor: doc() });
    expect(res.referral.target).toBe("ntp");
    expect(res.referral.sudRelated).toBe(true);
    const e = recordExternalNtpMedication({ patientId: p.id, ntpName: "Sequoia", dailyDose: "80 mg", actor: doc() });
    expect(e.reconciliationOnly).toBe(true);
    expect(AdelanteEHR.listOrders(p.id).length).toBe(before);
  });
});

describe("E2 external care partners", () => {
  it("seeds partners in all four clusters", () => {
    expect(new Set(listPartnerOrgs().map((o) => o.cluster))).toEqual(new Set(Object.keys(PARTNER_CLUSTERS)));
  });
  it("requires consent, enforces the cluster slice, excludes therapy notes, discloses and masks SUD links", () => {
    const [without, withConsent] = [patients()[2], patients()[3]];
    const coord = staff("s-cc1");
    expect(() => linkPartner({ patientId: without.id, orgId: "cp-plan", purpose: "Enrollment", actor: coord })).toThrow(/consent/i);
    recordLegalDisclosureConsent(withConsent.id, { name: "Dr", role: "physician" }, withConsent.firstName, { recipient: "Sequoia Valley Treatment Program (fictional NTP)", purpose: "Medication continuity" });
    expect(roleSeesAsamSection("physician", withConsent)).toBe(true);
    const l = linkPartner({ patientId: withConsent.id, orgId: "cp-plan", purpose: "Enrollment", actor: coord });
    expect(() => recordHandoff({ linkId: l.id, classes: ["Medications"], actor: coord })).toThrow(/can't receive/);
    expect(() => recordHandoff({ linkId: l.id, classes: ["Therapy notes"], actor: coord })).toThrow(/never shared/);
    const h = recordHandoff({ linkId: l.id, classes: ["Enrollment status"], actor: coord });
    expect(h.classes).toEqual(["Enrollment status"]);
    {
      const before = listDisclosureLog({ patientId: withConsent.id } as never).length;
      const ntp = linkPartner({ patientId: withConsent.id, orgId: DEMO_NTP_ID, purpose: "Medication continuity", actor: doc() });
      recordHandoff({ linkId: ntp.id, classes: ["MAT status"], actor: doc() });
      expect(listDisclosureLog({ patientId: withConsent.id } as never).length).toBe(before + 1);
      expect(visiblePartnerLinks(withConsent.id, "clinical_coordinator").some((x) => x.orgId === DEMO_NTP_ID)).toBe(false);
    }
  });
});

describe("county interim preparer", () => {
  it("lives in one constant with the interim label", () => {
    expect(COUNTY_INTERIM_PREPARER_ROLE).toBe("sud_counselor");
    expect(COUNTY_INTERIM_PREPARER_LABEL).toBe("Interim — pending decision");
    expect(COUNTY_REPORTING_ROLES).toContain(COUNTY_INTERIM_PREPARER_ROLE);
  });
});
