// §Batch B — timely access stamps + referral chase tasks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { addTimelyCorrection, listOffers, rawStamp, recordAppointmentOffer, timelyAccessFor, timelyAccessReport } from "@/lib/timelyAccess";
import { chaseRowsFor, chaseTaskFor, CHASE_FIELD_LABEL, referralCriticalProblem } from "@/lib/referralChase";
import type { StaffRole } from "@/lib/roles";

const mk = (extra: Record<string, unknown> = {}) =>
  AdelanteEHR.createReferral({
    firstName: "Chase",
    lastName: `Test${Math.random().toString(36).slice(2, 6)}`,
    dob: "1990-01-01",
    referringAgency: "County Probation",
    referrerName: "Officer Diaz",
    referrerPhone: "5595550100",
    referralSource: "probation",
    consentToContact: false,
    channel: "public",
    ...extra,
  } as never);
const coord = { role: "clinical_coordinator" as StaffRole, staffId: "s-coord-test", name: "Priya" };
const peer = { role: "peer_specialist" as StaffRole, staffId: "s-peer-test", name: "Andre" };

afterEach(() => vi.useRealTimers());

describe("B1 timely access stamps", () => {
  it("stamps the service request from the referral's system time", () => {
    const r = mk();
    expect(rawStamp(`r:${r.id}`, "request")?.at).toBe(r.createdAt);
  });
  it("earliest wins: a later offer never overwrites the first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T17:00:00Z"));
    const r = mk();
    recordAppointmentOffer({ name: "Luz", role: "ecm_provider" }, { referralId: r.id, slotStart: "2026-09-15T17:00:00Z", outcome: "declined", context: "referral_outreach" });
    const first = rawStamp(`r:${r.id}`, "offered")!.at;
    vi.setSystemTime(new Date("2026-09-12T17:00:00Z"));
    recordAppointmentOffer({ name: "Luz", role: "ecm_provider" }, { referralId: r.id, slotStart: "2026-09-18T17:00:00Z", outcome: "accepted", context: "referral_outreach" });
    expect(rawStamp(`r:${r.id}`, "offered")!.at).toBe(first);
    expect(first).toBe("2026-09-10T17:00:00.000Z");
  });
  it("records an offer even when the patient declines", () => {
    const p = AdelanteEHR.listPatients()[0];
    const before = listOffers().length;
    const res = runAction("timely_offer_record", { role: "therapist" }, undefined, { via: "recordAppointmentOffer", args: [{ name: "Marisol", role: "therapist" }, { patientId: p.id, slotStart: new Date(Date.now() + 86400000).toISOString(), outcome: "declined", context: "booking" }] });
    expect(res.ok).toBe(true);
    expect(listOffers().length).toBe(before + 1);
    expect(listOffers().at(-1)!.outcome).toBe("declined");
    expect(timelyAccessFor(p.id).offered).toBeDefined();
  });
  it("a correction note never changes the original stamp", () => {
    const p = AdelanteEHR.listPatients()[1];
    recordAppointmentOffer({ name: "Priya", role: "clinical_coordinator" }, { patientId: p.id, slotStart: new Date().toISOString(), outcome: "accepted", context: "booking" });
    const orig = timelyAccessFor(p.id).offered!.at;
    addTimelyCorrection({ name: "Priya", role: "clinical_coordinator" }, { patientId: p.id, kind: "offered", correctedAt: "2020-01-01T00:00:00Z", reason: "Offered by phone before booking" });
    const v = timelyAccessFor(p.id);
    expect(v.offered!.at).toBe(orig);
    expect(v.corrections.at(-1)!.reason).toMatch(/phone/);
    expect(() => addTimelyCorrection({ name: "Marisol", role: "therapist" }, { patientId: p.id, kind: "offered", correctedAt: "2020-01-01", reason: "x" })).toThrow();
    expect(() => addTimelyCorrection({ name: "Priya", role: "clinical_coordinator" }, { patientId: p.id, kind: "offered", correctedAt: "2020-01-01", reason: " " })).toThrow(/reason/);
  });
  it("report applies the small-cohort guard to medians", () => {
    const rep = timelyAccessReport();
    expect(rep.guard.minimumCohortSize).toBe(11);
    if (rep.guard.belowMinimumCohort) expect(rep.medianDaysToOffered).toBeUndefined();
  });
});

describe("B2 referral chase tasks", () => {
  it("critical fields: name, DOB or identifier, a way to reach person or referrer", () => {
    expect(referralCriticalProblem({ firstName: "A", lastName: "B", referrerPhone: "1" })).toMatch(/date of birth/);
    expect(referralCriticalProblem({ firstName: "A", lastName: "B", cin: "90000000A" })).toMatch(/reach/);
    expect(referralCriticalProblem({ firstName: "A", lastName: "B", dob: "1990-01-01", phone: "5" })).toBeNull();
  });
  it("routes to the coordinator pool when unassigned, to the owner when assigned, and duplicates overdue into the pool", () => {
    const r = mk();
    const t = chaseTaskFor(r.id)!;
    expect(t.status).toBe("open");
    expect(chaseRowsFor(coord).some((x) => x.referral.id === r.id && x.lane === "pool")).toBe(true);
    expect(chaseRowsFor({ role: "ecm_provider", staffId: "s-cm1" }).some((x) => x.referral.id === r.id)).toBe(false);
    const a = runAction("referral_assign_owner", { role: "clinical_coordinator" }, undefined, { args: [coord, r.id, "s-cm1"] });
    expect(a.ok).toBe(true);
    expect(chaseRowsFor({ role: "ecm_provider", staffId: "s-cm1" }).some((x) => x.referral.id === r.id && x.lane === "mine")).toBe(true);
    expect(chaseRowsFor(coord).some((x) => x.referral.id === r.id)).toBe(false);
    const later = new Date(+new Date(r.createdAt) + 8 * 86400000);
    expect(chaseRowsFor(coord, later).some((x) => x.referral.id === r.id && x.lane === "pool" && x.aging === "overdue")).toBe(true);
    expect(chaseRowsFor({ role: "ecm_provider", staffId: "s-cm1" }, later).some((x) => x.referral.id === r.id)).toBe(true);
  });
  it("peers fill a value but cannot own or close the task; it closes itself, audited", () => {
    const r = mk();
    const before = chaseTaskFor(r.id)!.missing.length;
    const f = runAction("referral_chase_fill", { role: "peer_specialist" }, undefined, { args: [peer, r.id, { preferredLanguage: "Spanish" }] });
    expect(f.ok).toBe(true);
    expect(chaseTaskFor(r.id)!.missing.length).toBe(before - 1);
    expect(chaseTaskFor(r.id)!.owner).toBeUndefined();
    expect(runAction("referral_chase_claim", { role: "peer_specialist" }, undefined, { args: [peer, r.id] }).ok).toBe(false);
    expect(runAction("referral_assign_owner", { role: "peer_specialist" }, undefined, { args: [peer, r.id, "s-cm1"] }).ok).toBe(false);
    runAction("referral_chase_fill", { role: "peer_specialist" }, undefined, { args: [peer, r.id, { cin: "90000000A", address: "1 Main", priorRecords: "none_known", emergencyContact: "Sister" }] });
    expect(chaseTaskFor(r.id)!.status).toBe("closed");
    expect(AdelanteEHR.listAuditEvents().some((e) => e.action === "referral_chase_closed" && (e.detail as { referralId?: string }).referralId === r.id)).toBe(true);
  });
  it("closes when the referral is declined", () => {
    const r = mk();
    AdelanteEHR.declineReferral(r.id, { reason: "not_eligible" } as never);
    expect(chaseTaskFor(r.id)!.status).toBe("closed");
  });
  it("clinicians, billing and admin never see the tasks or fill fields", () => {
    const r = mk();
    for (const role of ["therapist", "pmhnp", "physician", "billing", "billing_coordinator", "sys_admin"] as StaffRole[]) {
      expect(chaseRowsFor({ role, staffId: "x" }).length).toBe(0);
      expect(runAction("referral_chase_fill", { role }, undefined, { args: [{ role, name: "x" }, r.id, { address: "x" }] }).ok).toBe(false);
    }
  });
  it("uses neutral wording in task, notification and audit text", () => {
    const r = mk({ justiceInvolved: "yes", substanceUseNeed: true });
    const row = chaseRowsFor(coord).find((x) => x.referral.id === r.id)!;
    expect(row.text).toContain(`Missing: ${CHASE_FIELD_LABEL.cin}`);
    expect(row.text).toContain("custody detail");
    runAction("referral_chase_fill", { role: "community_health_worker" }, undefined, { args: [{ role: "community_health_worker", name: "Kayla" }, r.id, { pendingCharges: "yes", releaseDate: "2026-10-01" }] });
    const banned = /charge|substance|sud|opioid|alcohol|treatment|2026-10-01/i;
    const audits = AdelanteEHR.listAuditEvents().filter((e) => (e.detail as { referralId?: string } | undefined)?.referralId === r.id && /chase|referral_chase/.test(`${e.action} ${JSON.stringify(e.detail)}`));
    expect(audits.length).toBeGreaterThan(0);
    for (const e of audits) expect(JSON.stringify(e.detail)).not.toMatch(banned);
    const notes = AdelanteEHR.listNotifications().filter((n) => n.subject === "Referral details to follow up");
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(`${n.subject} ${n.body}`).not.toMatch(banned);
  });
});
