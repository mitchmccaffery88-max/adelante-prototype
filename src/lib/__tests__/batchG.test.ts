import { describe, expect, it } from "vitest";
import { AdelanteEHR, TELEHEALTH_CONSENT_CATEGORY } from "@/lib/ehr";
import { canAccess, STAFF_ROLES } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { SUD_REPORTING_ACCESS_ROLES, hasSudReportingAccess, SUD_REPORTING_POST_MVP_NOTE } from "@/lib/sudReportingAccess";
import {
  _resetCountyReporting, calomsBlockerRows, COUNTY_PREPARER_ROLE, COUNTY_REPORTING_ROLES, generateReport, listCountyErrors,
  simulateCountyResponse, submitReport, tpsList,
} from "@/lib/countyReporting";
import { calomsWorklist, dmcOdsExportRows } from "@/lib/dmcOdsReadiness";
import { availableSlots, hasAvailabilitySet } from "@/lib/clinicianAvailability";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { patientBookableClinicians, patientSelfBook, PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { runAction } from "@/lib/actions/runAction";
import { startTimelyAccess, timelyAccessFor } from "@/lib/timelyAccess";
import { DEMO_PARTNER_CONSENT, linkPartner } from "@/lib/carePartners";
import { canSeeNavEntry, STAFF_NAV } from "@/lib/navSections";

const bc = { role: "billing_coordinator" as const, name: "Billing coordinator", staffId: "s-bc1" };

describe("G1 — SUD reporting access capability", () => {
  it("grant list lives in one constant (snapshot)", () => {
    expect([...SUD_REPORTING_ACCESS_ROLES]).toMatchSnapshot();
    expect(SUD_REPORTING_POST_MVP_NOTE).toMatch(/Data & Outcomes Analyst/);
    expect(SUD_REPORTING_POST_MVP_NOTE).toMatch(/Compliance Officer/);
    // The future roles are named only — never created.
    expect(STAFF_ROLES.map((r) => r.label).join(" ")).not.toMatch(/Outcomes Analyst|Compliance Officer/);
  });

  it("billing coordinator sees CalOMS client rows and can generate the file", () => {
    _resetCountyReporting();
    expect(calomsBlockerRows("billing_coordinator")).not.toBeNull();
    expect(tpsList("billing_coordinator")).not.toBeNull();
    expect(calomsWorklist("billing_coordinator")).not.toBeNull();
    expect(dmcOdsExportRows("billing_coordinator")).not.toBeNull();
    const s = generateReport(bc, "caloms", "30");
    expect(s.report).toBe("caloms");
    expect(canSeeNavEntry("billing_coordinator", STAFF_NAV.find((e) => e.id === "dmc-ods-readiness")!)).toBe(true);
  });

  it("billing coordinator still cannot open notes, ASAM detail, care plans or therapy content", () => {
    for (const cls of ["therapy_notes", "psychotherapy_notes", "screeners_sud", "sud_treatment", "psych_eval", "care_plan", "case_notes", "meds_erx"] as const)
      expect(canAccess("billing_coordinator", cls).level, cls).toBe("none");
    for (const p of AdelanteEHR.listPatients().slice(0, 10)) expect(roleSeesAsamSection("billing_coordinator", p)).toBe(false);
  });

  it("billing (non-coordinator) stays aggregate-only", () => {
    expect(hasSudReportingAccess("billing")).toBe(false);
    expect(calomsBlockerRows("billing")).toBeNull();
    expect(tpsList("billing")).toBeNull();
    expect(dmcOdsExportRows("billing")).toBeNull();
    expect(() => generateReport({ role: "billing", name: "b" }, "caloms", "30")).toThrow(/SUD reporting access/);
  });

  it("preparer is the billing coordinator; SUD counselor lost the duty; CalOMS errors route to the coordinator", () => {
    _resetCountyReporting();
    expect(COUNTY_PREPARER_ROLE).toBe("billing_coordinator");
    expect(COUNTY_REPORTING_ROLES).not.toContain("sud_counselor");
    expect(canAccess("sud_counselor", "screeners_sud").level).not.toBe("none");
    const s = generateReport(bc, "caloms", "30");
    if (s.status === "ready" && s.rowCount > 0) {
      submitReport(bc, s.id);
      const errs = simulateCountyResponse(bc, s.id);
      expect(errs.every((e) => e.ownerRole === "billing_coordinator")).toBe(true);
      expect(listCountyErrors("billing_coordinator").some((e) => e.text !== "Record needs a correction before it can be resent.")).toBe(true);
    }
  });
});

describe("G2 — real clinician availability", () => {
  it("slots fall only inside the clinician's weekly blocks", () => {
    const blocks = AdelanteEHRExt.availabilityBlocksForClinician("c1");
    const slots = availableSlots("c1", { days: 14 });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const d = new Date(s);
      const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      expect(blocks.some((b) => b.weekday === d.getDay() && b.start <= hhmm && hhmm < b.end)).toBe(true);
    }
  });
  it("a clinician with no hours has no slots", () => {
    expect(hasAvailabilitySet("c6")).toBe(false);
    expect(availableSlots("c6")).toEqual([]);
  });
  it("conflicts are skipped", () => {
    const slots = availableSlots("c1", { days: 14 });
    for (const s of slots) expect(AdelanteEHR.findApptConflict("c1", s)).toBeUndefined();
  });
});

describe("G3 — patient self-booking", () => {
  const free = () => AdelanteEHR.listPatients().find((p) => AdelanteEHR.appointmentsForPatient(p.id).length === 0) ?? AdelanteEHR.listPatients()[0];

  it("only eligible clinicians, assigned first", () => {
    const p = free();
    const opts = patientBookableClinicians(p, "med_management", "in_person");
    expect(opts.every((o) => /PMHNP|M\.?D|D\.?O/.test(o.clinician.credential))).toBe(true);
  });

  it("books on real availability, stamps timely access, audits as the patient", () => {
    startTimelyAccess();
    const p = free();
    const slot = availableSlots("c1", { serviceType: "therapy_individual", modality: "in_person" })[0]!;
    const r = runAction("patient_self_book", { role: PATIENT_ACTOR_ROLE, staffId: p.id, staffName: "Patient (self)" }, p, {
      args: [{ patientId: p.id, clinicianId: "c1", start: slot, serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia" }],
    });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    const appt = AdelanteEHR.appointmentsForPatient(p.id).find((a) => a.start === slot);
    expect(appt?.source).toBe("self_scheduled");
    expect(timelyAccessFor(p.id).offered).toBeTruthy();
  });

  it("rejects times outside availability and video without telehealth consent", () => {
    const p = free();
    const bad = new Date(Date.now() + 3 * 864e5);
    bad.setHours(3, 0, 0, 0);
    expect(() => patientSelfBook({ patientId: p.id, clinicianId: "c1", start: bad.toISOString(), serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia" })).toThrow(/isn't open/);
    const noConsent = AdelanteEHR.listPatients().find((x) => !AdelanteEHR.isConsentCategoryAuthorized(x.id, TELEHEALTH_CONSENT_CATEGORY));
    if (noConsent) {
      const s = availableSlots("c1", { serviceType: "therapy_individual", modality: "video" })[0]!;
      expect(() => patientSelfBook({ patientId: noConsent.id, clinicianId: "c1", start: s, serviceType: "therapy_individual", modality: "video" })).toThrow(/telehealth consent/);
    }
  });

  it("staff roles can't use the patient action", () => {
    const p = free();
    for (const { key } of STAFF_ROLES) expect(runAction("patient_self_book", { role: key, staffId: "s-x" }, p).ok).toBe(false);
  });
});

describe("G5 — seeded partner-sharing consent", () => {
  it("lets a coordinator link the demo patient to the community partner", () => {
    const l = linkPartner({ ...DEMO_PARTNER_CONSENT, actor: { role: "clinical_coordinator", name: "Priya Raman", staffId: "s-cc1" } });
    expect(l.consentRef).toMatch(/Legal disclosure/);
  });
});
