// §Part 2 flag notification matrix — regression coverage for EVERY flag
// variant (patient self-flag at send time, staff flag, staff unflag, repeat
// flag) crossed with the patient's SUD consent state (on/off, i.e. the case
// manager un-gated/locked).
//
// The assertions are exact counts, not "greater than": a duplicate alert is a
// failure in the same way a silent miss is. Notifications are diffed per
// patient around each action so unrelated feed traffic can't mask either.
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";

const GENERIC_BODY = "A patient sent a message to their care team.";
const VISIBILITY_COPY = /flagged for Part 2 protection/;

// A patient with a resolvable assigned case manager, so the direct-address
// path (not the role broadcast) is the one under test.
const patient = () =>
  AdelanteEHR.listPatients().find((p) => p.caseManagerId === "cm1")!;
const cmName = () =>
  AdelanteEHR.listCaseManagers().find((c) => c.id === patient().caseManagerId)!.name;

/** Notifications created for this patient by `run()`, newest last. */
function diff(pid: string, run: () => void) {
  const before = new Set(AdelanteEHR.listNotifications().map((n) => n.id));
  run();
  return AdelanteEHR.listNotifications()
    .filter((n) => !before.has(n.id) && n.patientId === pid)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function setConsentOn(pid: string, on: boolean) {
  AdelanteEHR.setConsent(pid, "part2Sud", on);
}

describe("Part 2 flag notification matrix", () => {
  beforeEach(() => {
    // Every case sets its own consent state explicitly; start from granted.
    setConsentOn(patient().id, true);
  });

  it("baseline: consent on/off flips exactly the case-manager lock, therapist/pmhnp never", () => {
    const p = patient();
    setConsentOn(p.id, true);
    expect(canAccess("ecm_provider", "screeners_sud", AdelanteEHR.getPatient(p.id)!).locked).toBe(
      false,
    );
    setConsentOn(p.id, false);
    const gated = AdelanteEHR.getPatient(p.id)!;
    expect(canAccess("ecm_provider", "screeners_sud", gated).locked).toBe(true);
    expect(canAccess("peer_specialist", "screeners_sud", gated).locked).toBe(true);
    expect(canAccess("therapist", "screeners_sud", gated).locked).toBe(false);
    expect(canAccess("pmhnp", "screeners_sud", gated).locked).toBe(false);
  });

  // ---- Patient self-flag at send time ----
  it("self-flag + consent OFF → exactly one CM alert and one un-gated backstop", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const rows = diff(pid, () => AdelanteEHR.sendPatientMessage(pid, "sensitive", true));
    expect(rows.length).toBe(2);
    expect(rows.every((n) => n.body === GENERIC_BODY)).toBe(true);
    // One direct-addressed to the case manager, one broadcast to an un-gated role.
    const direct = rows.filter((n) => n.recipientStaffId === cmName());
    const broadcast = rows.filter((n) => !!n.recipientRole);
    expect(direct.length).toBe(1);
    expect(broadcast.length).toBe(1);
    expect(
      canAccess(broadcast[0].recipientRole!, "screeners_sud", AdelanteEHR.getPatient(pid)!).locked,
    ).toBe(false);
  });

  it("self-flag + consent ON → exactly one notification (no unnecessary backstop)", () => {
    const pid = patient().id;
    setConsentOn(pid, true);
    const rows = diff(pid, () => AdelanteEHR.sendPatientMessage(pid, "sensitive", true));
    expect(rows.length).toBe(1);
    expect(rows[0].recipientStaffId).toBe(cmName());
  });

  it("unflagged patient message → exactly one notification under either consent state", () => {
    const pid = patient().id;
    for (const on of [true, false]) {
      setConsentOn(pid, on);
      const rows = diff(pid, () => AdelanteEHR.sendPatientMessage(pid, "ordinary"));
      expect(rows.length).toBe(1);
      expect(rows[0].recipientStaffId).toBe(cmName());
    }
  });

  // ---- Staff-initiated (retroactive) flag ----
  it("staff flag + consent OFF → visibility alert to the CM plus one backstop, no duplicates", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const m = AdelanteEHR.sendStaffMessage(pid, "Dr. Bagga", "note")!;
    const rows = diff(pid, () => AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Bagga", "pmhnp"));
    expect(rows.length).toBe(2);

    const cmRow = rows.find((n) => n.recipientStaffId === cmName())!;
    expect(cmRow).toBeTruthy();
    expect(cmRow.body).toMatch(VISIBILITY_COPY);
    expect(cmRow.subject).toMatch(/visibility changed/i);

    const backstop = rows.find((n) => !!n.recipientRole)!;
    expect(backstop.recipientRole).toBe("therapist"); // flagger's own role excluded
    expect(backstop.body).toBe(GENERIC_BODY);
  });

  it("staff flag by a therapist + consent OFF → backstop falls through to pmhnp", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const m = AdelanteEHR.sendStaffMessage(pid, "Dr. Marisol Reyes", "note")!;
    const rows = diff(pid, () =>
      AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Marisol Reyes", "therapist"),
    );
    expect(rows.length).toBe(2);
    expect(rows.find((n) => !!n.recipientRole)!.recipientRole).toBe("pmhnp");
  });

  it("staff flag BY the assigned case manager + consent OFF → backstop only, no self-notification", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const m = AdelanteEHR.sendStaffMessage(pid, cmName(), "note")!;
    const rows = diff(pid, () =>
      AdelanteEHR.flagMessageAsSud(pid, m.id, cmName(), "ecm_provider"),
    );
    expect(rows.length).toBe(1);
    expect(rows[0].recipientStaffId).toBeUndefined();
    expect(rows[0].recipientRole).toBe("therapist");
    expect(rows.some((n) => VISIBILITY_COPY.test(n.body))).toBe(false);
  });

  it("staff flag + consent ON → no notifications at all (nothing was hidden)", () => {
    const pid = patient().id;
    setConsentOn(pid, true);
    const m = AdelanteEHR.sendStaffMessage(pid, "Dr. Bagga", "note")!;
    const rows = diff(pid, () => AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Bagga", "pmhnp"));
    expect(rows.length).toBe(0);
  });

  // ---- Unflag + idempotency ----
  it("unflag never notifies, under either consent state", () => {
    for (const on of [true, false]) {
      const pid = patient().id;
      setConsentOn(pid, on);
      const m = AdelanteEHR.sendStaffMessage(pid, "Dr. Bagga", "note")!;
      AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Bagga", "pmhnp");
      const rows = diff(pid, () =>
        AdelanteEHR.unflagMessageAsSud(pid, m.id, "Dr. Bagga", "pmhnp"),
      );
      expect(rows.length).toBe(0);
    }
  });

  it("re-flagging an already-flagged message emits nothing (no duplicate alerts)", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const m = AdelanteEHR.sendStaffMessage(pid, "Dr. Bagga", "note")!;
    expect(diff(pid, () => AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Bagga", "pmhnp")).length,
    ).toBe(2);
    const again = diff(pid, () =>
      AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Marisol Reyes", "therapist"),
    );
    expect(again.length).toBe(0);
  });

  it("a self-flagged message re-flagged by staff emits nothing new either", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const m = AdelanteEHR.sendPatientMessage(pid, "sensitive", true)!;
    const again = diff(pid, () => AdelanteEHR.flagMessageAsSud(pid, m.id, "Dr. Bagga", "pmhnp"));
    expect(again.length).toBe(0);
  });

  it("a rejected flag (role without messaging write) changes nothing and notifies nobody", () => {
    const pid = patient().id;
    setConsentOn(pid, false);
    const m = AdelanteEHR.sendStaffMessage(pid, "Tonya Price", "note")!;
    const rows = diff(pid, () => {
      expect(AdelanteEHR.flagMessageAsSud(pid, m.id, "Tonya Price", "billing")).toBe(false);
    });
    expect(rows.length).toBe(0);
    expect(AdelanteEHR.listCareMessages(pid).find((x) => x.id === m.id)!.sudFlagged).toBeFalsy();
  });
});
