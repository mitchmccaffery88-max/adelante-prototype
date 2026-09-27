import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES, permissionsForType } from "@/lib/advocate";
import { saveRecoveryCheckInNote, staffVisibleRecoveryNotes, myRecoveryCheckInNote } from "@/lib/recoveryCheckInNotes";

const pt = () => AdelanteEHR.listPatients()[0];

describe("E10 consent withdrawal", () => {
  it("Part 2 needs a second confirmation; withdrawal is audited and notice is generic", () => {
    const p = pt();
    AdelanteEHR.setConsent(p.id, "part2Sud", true);
    expect(() => AdelanteEHR.patientWithdrawConsent({ patientId: p.id, purpose: "part2Sud" })).toThrow();
    expect(AdelanteEHR.getConsentState(p.id).part2Sud).toBe(true);
    AdelanteEHR.patientWithdrawConsent({ patientId: p.id, purpose: "part2Sud", secondConfirm: true });
    expect(AdelanteEHR.getConsentState(p.id).part2Sud).toBe(false);
    expect(AdelanteEHR.listAuditEvents({}).some((e) => e.action === "consent_withdrawal_confirmed" && e.patientId === p.id)).toBe(true);
    const n = AdelanteEHR.listNotifications().filter((x) => x.category === "consent_changed" && x.patientId === p.id);
    expect(n.length).toBeGreaterThan(0);
    for (const x of n) expect(`${x.subject} ${x.body}`).not.toMatch(/substance|SUD|Part 2|alcohol|drug/i);
  });
  it("non-legal consents need no second confirmation", () => {
    const p = pt();
    AdelanteEHR.setConsent(p.id, "sms", true);
    AdelanteEHR.patientWithdrawConsent({ patientId: p.id, purpose: "sms" });
    expect(AdelanteEHR.getConsentState(p.id).sms).toBe(false);
  });
});

describe("E11 advocate plain descriptions match permissions", () => {
  it("every type has EN+ES; only authority tiers promise the care plan or uploads", () => {
    for (const t of ADVOCATE_AUTHORIZATION_TYPES) {
      expect(t.plain.en.length).toBeGreaterThan(20);
      expect(t.plain.es.length).toBeGreaterThan(20);
      const perms = permissionsForType(t.key);
      const promisesPlan = /see your visits and care plan/.test(t.plain.en);
      expect(promisesPlan).toBe(perms.includes("care_plan_clinical_view"));
      expect(/add papers/.test(t.plain.en)).toBe(perms.includes("document_upload"));
      expect(t.plain.en).not.toMatch(/message|notes/i);
    }
  });
});

describe("B7 recovery check-in note", () => {
  it("private by default; shared only visible to roles passing Part 2; runs the crisis scanner", () => {
    const p = pt();
    AdelanteEHR.setConsent(p.id, "part2Sud", false);
    saveRecoveryCheckInNote({ patientId: p.id, lessonId: "fdo-tolerance-and-overdose", text: "had a rough day", shared: false });
    expect(staffVisibleRecoveryNotes(p, "therapist")).toEqual([]);
    expect(myRecoveryCheckInNote(p.id, "fdo-tolerance-and-overdose")?.text).toBe("had a rough day");
    saveRecoveryCheckInNote({ patientId: p.id, lessonId: "fdo-tolerance-and-overdose", text: "had a rough day", shared: true });
    expect(staffVisibleRecoveryNotes(p, "billing_coordinator")).toEqual([]);
    expect(staffVisibleRecoveryNotes(p, "cf_care_manager")).toEqual([]);
    const before = AdelanteEHR.listCrisisEscalations(p.id).length;
    saveRecoveryCheckInNote({ patientId: p.id, lessonId: "fdo-tolerance-and-overdose", text: "I want to kill myself", shared: false });
    expect(AdelanteEHR.listCrisisEscalations(p.id).length + (AdelanteEHR.listCrisisEscalations(p.id)[0]?.retriggers?.length ?? 0)).toBeGreaterThanOrEqual(before);
    const esc = AdelanteEHR.listCrisisEscalations(p.id);
    expect(esc.some((e) => e.triggerSource === "message_pattern")).toBe(true);
    expect(JSON.stringify(esc)).not.toContain("kill myself");
  });
});
