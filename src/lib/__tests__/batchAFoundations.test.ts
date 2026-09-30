// §Batch A — data foundations: provider reference, FSP flag, AFBI outreach,
// funding + care continuum on every service.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { runAction } from "@/lib/actions/runAction";
import { isJusticeInvolved } from "@/lib/justiceInvolvement";
import { logContact } from "@/lib/caseloadReview";
import {
  canReadProviderRef,
  listPrograms,
  listSites,
  MPF_MATCH_LABEL,
  PLACEHOLDER_LABEL,
  programConfigForCounty,
  providerReadiness,
  renderingPractitioners,
  saveSite,
} from "@/lib/providerReference";
import { fspStatusFor, monthsBetween, recordCustodyDuration, reportingAgeBand } from "@/lib/fspEligibility";
import {
  afbiCounts,
  decideAfbiLink,
  getAfbiContact,
  listAfbiContactsFor,
  listAfbiLinkRequests,
  recordAfbiContact,
  requestAfbiLink,
} from "@/lib/afbiOutreach";
import { AFBI_NOT_CLAIMABLE } from "@/lib/afbiGuard";
import {
  CARE_CONTINUUM,
  classificationDisplay,
  deriveClassification,
  getServiceClassification,
  overrideServiceClassification,
  sweepServiceClassification,
} from "@/lib/serviceClassification";

const ji = () => AdelanteEHR.listPatients().find((p) => isJusticeInvolved(p))!;
const nonJi = () => AdelanteEHR.listPatients().find((p) => !isJusticeInvolved(p))!;
const peer = { role: "peer_specialist" as const, name: "Probe Peer", staffId: "s-probe" };

describe("A1 provider & site reference", () => {
  it("seeds Premier Visalia with labelled placeholder values and draft cadences", () => {
    const site = listSites().find((s) => s.name === "Premier Visalia")!;
    expect(site.placeholder).toBe(true);
    expect(PLACEHOLDER_LABEL).toMatch(/^Simulated/);
    expect(site.county).toBe("Tulare");
    const prog = listPrograms(site.id)[0]!;
    expect(prog.reporting).toEqual(expect.arrayContaining([expect.objectContaining({ report: "CalOMS", dueDay: 15 }), expect.objectContaining({ report: "DATAR", dueDay: 10 })]));
    expect(programConfigForCounty("tulare")).toHaveLength(1);
  });
  it("readiness shows missing fields, expiring cert and simulated MPF match", () => {
    const r = providerReadiness();
    expect(r.mpfMatch).toBe(MPF_MATCH_LABEL);
    expect(r.missing.some((m) => m.field === "Medi-Cal provider number")).toBe(true);
    expect(r.expiring.length).toBeGreaterThan(0);
  });
  it("practitioner NPIs come from the staff roster", () => {
    expect(renderingPractitioners().length).toBeGreaterThan(0);
  });
  it("only sys_admin edits; billing / credentialing read; runAction audits", () => {
    expect(canReadProviderRef("billing")).toBe(true);
    expect(canReadProviderRef("therapist")).toBe(false);
    const site = listSites()[0]!;
    expect(() => saveSite({ role: "billing" }, { ...site })).toThrow(/system administrator/);
    const blocked = runAction("provider_ref_save", { role: "billing" }, undefined, { via: "saveSite", args: [{ role: "billing" }, site] });
    expect(blocked.ok).toBe(false);
    const ok = runAction("provider_ref_save", { role: "sys_admin" }, undefined, { via: "saveSite", args: [{ role: "sys_admin" }, { ...site, mediCalProviderNumber: "MC-000000", placeholder: true }] });
    expect(ok.ok).toBe(true);
    expect(ok.event.action).toBe("action.succeeded");
  });
});

describe("A2 FSP presumptive eligibility", () => {
  it("6+ months → eligible, recalculates and keeps history", () => {
    const p = ji();
    const a = recordCustodyDuration({ role: "ecm_provider", name: "Luz" }, p.id, { totalMonths: 4, provenance: "self_report" });
    expect(a.fspPresumptiveEligible).toBe(false);
    const b = recordCustodyDuration({ role: "ecm_provider", name: "Luz" }, p.id, { custodyStart: "2025-01-10", custodyEnd: "2025-08-10", provenance: "custody_record" });
    expect(b.months).toBe(7);
    expect(b.fspPresumptiveEligible).toBe(true);
    expect(b.history).toHaveLength(2);
    expect(b.history[1]!.by).toBe("Luz");
  });
  it("hidden for non-justice-involved patients and for roles without custody access", () => {
    expect(fspStatusFor("ecm_provider", nonJi().id)).toBeNull();
    expect(fspStatusFor("billing", ji().id)).toBeNull();
    expect(() => recordCustodyDuration({ role: "therapist", name: "T" }, ji().id, { totalMonths: 8, provenance: "self_report" })).toThrow(/can't record/);
    expect(() => recordCustodyDuration({ role: "ecm_provider", name: "L" }, nonJi().id, { totalMonths: 8, provenance: "self_report" })).toThrow(/justice-involved/);
  });
  it("age band at the service date", () => {
    expect(reportingAgeBand("2000-06-15", "2026-06-14")).toBe("25_and_under");
    expect(reportingAgeBand("2000-06-15", "2026-06-15")).toBe("26_and_older");
    expect(monthsBetween("2025-01-31", "2025-07-30")).toBe(5);
  });
});

describe("A3 AFBI field outreach", () => {
  it("records a pre-enrollment contact, always ISL, never claimable", () => {
    const c = recordAfbiContact(peer, { locationType: "street", initials: "jd", activities: ["engagement", "naloxone"], minutes: 15, outcome: "engaged" });
    expect(c.fundingLane).toBe("isl_non_medi_cal");
    expect(c.initials).toBe("JD");
    const cls = getServiceClassification({ kind: "afbi_contact", id: c.id })!;
    expect(cls.fundingSource).toBe("isl_non_medi_cal");
    expect(cls.careContinuum).toBe("outreach_engagement");
    // Every claim path refuses an AFBI record.
    const pid = ji().id;
    const paths: (() => unknown)[] = [
      () => AdelanteEHRExt.upsertClaimFromEncounter(c.id),
      () => AdelanteEHRExt.createAsamClaim({ asamId: c.id, patientId: pid, clinicianId: "c1", serviceDate: "2026-09-01" }),
      () => AdelanteEHRExt.upsertClaimFromGroupAttendee({ sessionId: c.id, occurrenceStart: c.at, patientId: pid, facilitatorId: "c1" } as never),
      () => AdelanteEHRExt.upsertClaimFromPeerNote({ patientId: pid, peerNoteId: c.id, staffId: "s", clinicianId: "c1", minutes: 30 }),
      () => AdelanteEHRExt.upsertClaimFromChwNote({ patientId: pid, noteId: c.id, staffId: "s", clinicianId: "c1", dateISO: "2026-09-01", minutes: 30 }),
    ];
    for (const run of paths) expect(run).toThrow(AFBI_NOT_CLAIMABLE);
    expect(AdelanteEHRExt.listClaims().some((cl) => cl.encounterId.includes(c.id))).toBe(false);
    // Override can never move it onto a Medi-Cal lane.
    expect(() => overrideServiceClassification({ role: "billing_coordinator", name: "B" }, { kind: "afbi_contact", id: c.id }, { fundingSource: "medi_cal_ffs", reason: "x" })).toThrow(/never use a Medi-Cal/);
  });
  it("role gate, Part 2 view and billing counts only", () => {
    expect(() => recordAfbiContact({ role: "billing", name: "B" }, { locationType: "street", initials: "X", activities: ["engagement"], minutes: 5, outcome: "engaged" })).toThrow();
    expect(listAfbiContactsFor("billing")).toEqual([]);
    const counts = afbiCounts();
    expect(counts.contacts).toBeGreaterThan(0);
    expect(counts.guard.belowMinimumCohort).toBe(true);
    const r = runAction("afbi_contact", { role: "peer_specialist" }, undefined, { args: [peer, { locationType: "shelter", initials: "AB", activities: ["mat_referral"], minutes: 10, outcome: "linked" }] });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.event.detail)).not.toMatch(/mat|naloxone|AB/);
  });
  it("links to a chart only through the matching review, never auto-merged", () => {
    const c = recordAfbiContact(peer, { locationType: "release_gate", initials: "ZZ", activities: ["linkage"], minutes: 20, outcome: "linked" });
    const pid = nonJi().id;
    const req = requestAfbiLink(peer, c.id, pid);
    expect(getAfbiContact(c.id)!.patientId).toBeUndefined();
    expect(listAfbiLinkRequests("open").some((l) => l.id === req.id)).toBe(true);
    expect(() => decideAfbiLink(peer, req.id, true)).toThrow(/coordinator/);
    decideAfbiLink({ role: "clinical_coordinator", name: "Priya" }, req.id, true);
    expect(getAfbiContact(c.id)!.patientId).toBe(pid);
    expect(getAfbiContact(c.id)!.initials).toBeUndefined();
  });
});

describe("A4 funding source + care continuum on every service", () => {
  it("every creation path sets both fields by rule", () => {
    const p = nonJi();
    const appt = AdelanteEHR.listAppointments()[0]!;
    sweepServiceClassification();
    const a = getServiceClassification({ kind: "appointment", id: appt.id })!;
    expect(a.fundingSource).toBeTruthy();
    expect(a.careContinuum).toBeTruthy();
    expect(a.source).toBe("rule");
    const contact = logContact({ id: "s-ecm", name: "Luz", role: "ecm_provider" } as never, { patientId: p.id, type: "phone" as never, date: "2026-09-01" });
    expect(getServiceClassification({ kind: "case_contact", id: contact.id })!.careContinuum).toBe("case_management");
    const withPeer = AdelanteEHR.listPatients().find((x) => (x.peerNotes ?? []).length)!;
    if (withPeer) expect(getServiceClassification({ kind: "peer_contact", id: withPeer.peerNotes![0]!.id })!.careContinuum).toBe("recovery_support");
    for (const g of AdelanteEHR.listGroupSessions())
      for (const occ of AdelanteEHR.listGroupOccurrenceRecords(g.id))
        for (const att of occ.attendance ?? []) expect(getServiceClassification({ kind: "group_attendance", id: `${occ.id}:${att.patientId}` })).toBeTruthy();
    expect(CARE_CONTINUUM).toHaveLength(8);
  });
  it("rule: MAT for med management in a SUD episode; hidden from roles without SUD access", () => {
    const p = { ...nonJi(), episodes: [{ id: "e", type: "sud_dmc_ods" as const, state: "engaged", openedAt: "2026-01-01" }], coverage: { status: "active" as const, verified: "verified" as const } };
    const d = deriveClassification({ kind: "appointment", patient: p as never, serviceType: "med_management" });
    expect(d.careContinuum).toBe("mat");
    expect(d.fundingSource).toBe("dmc_ods");
    const row = { ref: { kind: "appointment" as const, id: "x" }, serviceDate: "2026-09-01", ...d, source: "rule" as const, setAt: "", history: [] };
    expect(classificationDisplay(row, "billing").continuum).toBe("Restricted");
  });
  it("override: coordinator only, reason required, history kept, audited", () => {
    const appt = AdelanteEHR.listAppointments()[1]!;
    const ref = { kind: "appointment" as const, id: appt.id };
    expect(() => overrideServiceClassification({ role: "therapist", name: "T" }, ref, { careContinuum: "crisis", reason: "x" })).toThrow(/coordinator/);
    expect(() => overrideServiceClassification({ role: "clinical_coordinator", name: "P" }, ref, { careContinuum: "crisis", reason: " " })).toThrow(/reason/);
    const r = runAction("service_classification_override", { role: "clinical_coordinator" }, undefined, { args: [{ role: "clinical_coordinator", name: "Priya" }, ref, { careContinuum: "crisis", reason: "Crisis visit" }] });
    expect(r.ok).toBe(true);
    const row = getServiceClassification(ref)!;
    expect(row.source).toBe("override");
    expect(row.history.at(-1)!.reason).toBe("Crisis visit");
  });
});
