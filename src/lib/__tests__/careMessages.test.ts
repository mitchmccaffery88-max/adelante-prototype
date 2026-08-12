import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";
import { isMessageBodyMasked, MASKED_MESSAGE_BODY, visibleMessageBody } from "@/lib/careMessageMasking";

const patientId = () => AdelanteEHR.listPatients()[0].id;

describe("care messaging — Phase 2", () => {
  it("stores a patient message verbatim, without translation or edits", () => {
    const pid = patientId();
    const body = "  Necesito ayuda con mi receta.\n\nGracias — Ana  ";
    const msg = AdelanteEHR.sendPatientMessage(pid, body)!;
    expect(msg.body).toBe(body);
    expect(AdelanteEHR.listCareMessages(pid).at(-1)!.body).toBe(body);
    expect(msg.authorType).toBe("patient");
  });

  it("notifies the assigned case manager by name, not the whole role", () => {
    const pid = AdelanteEHR.listPatients().find((p) => p.caseManagerId === "cm1")!.id;
    AdelanteEHR.sendPatientMessage(pid, "Question about my next visit");
    const direct = AdelanteEHR.listNotificationsFor("Lupita Sanchez, MSW");
    const hit = direct.find((n) => n.category === "patient_message" && n.patientId === pid);
    expect(hit).toBeTruthy();
    expect(hit!.linkRoute).toBe("/record/$patientId");
    expect(hit!.linkParams?.section).toBe("messages");
    expect(hit!.recipientRole).toBeUndefined();
  });

  it("tracks unread independently for each side", () => {
    const pid = AdelanteEHR.listPatients()[2].id;
    AdelanteEHR.sendPatientMessage(pid, "hello");
    expect(AdelanteEHR.unreadCountForStaff(pid)).toBe(1);
    expect(AdelanteEHR.unreadCountForPatient(pid)).toBe(0);

    AdelanteEHR.sendStaffMessage(pid, "Anita Brooks", "hi back");
    expect(AdelanteEHR.unreadCountForPatient(pid)).toBe(1);
    expect(AdelanteEHR.unreadCountForStaff(pid)).toBe(1);

    // Patient reading does not clear staff's unread.
    AdelanteEHR.markMessagesReadByPatient(pid);
    expect(AdelanteEHR.unreadCountForPatient(pid)).toBe(0);
    expect(AdelanteEHR.unreadCountForStaff(pid)).toBe(1);

    // ...and vice versa.
    AdelanteEHR.sendStaffMessage(pid, "Anita Brooks", "still here");
    AdelanteEHR.markMessagesReadByStaff(pid, "Anita Brooks");
    expect(AdelanteEHR.unreadCountForStaff(pid)).toBe(0);
    expect(AdelanteEHR.unreadCountForPatient(pid)).toBe(1);
  });

  it("sorts the cross-patient queue oldest-unread-first", () => {
    const [a, b] = [AdelanteEHR.listPatients()[3].id, AdelanteEHR.listPatients()[4].id];
    AdelanteEHR.markMessagesReadByStaff(a, "x");
    AdelanteEHR.markMessagesReadByStaff(b, "x");
    AdelanteEHR.sendPatientMessage(a, "first");
    AdelanteEHR.sendPatientMessage(b, "second");
    const rows = AdelanteEHR.listUnreadMessageThreads();
    const ia = rows.findIndex((r) => r.patient.id === a);
    const ib = rows.findIndex((r) => r.patient.id === b);
    expect(ia).toBeGreaterThanOrEqual(0);
    expect(ia).toBeLessThan(ib);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].oldestUnreadAt <= rows[i].oldestUnreadAt).toBe(true);
    }
  });

  it("gates messaging: treating roles write, billing none", () => {
    expect(canAccess("ecm_provider", "patient_messaging").level).toBe("write");
    expect(canAccess("therapist", "patient_messaging").level).toBe("write");
    expect(canAccess("pmhnp", "patient_messaging").level).toBe("write");
    // §Peer messaging — peers answer members; Part 2 flagging stays narrower.
    expect(canAccess("peer_specialist", "patient_messaging").level).toBe("write");
    expect(canAccess("billing", "patient_messaging").locked).toBe(true);
  });

  it("ignores empty message bodies", () => {
    const pid = patientId();
    expect(AdelanteEHR.sendPatientMessage(pid, "   ")).toBeUndefined();
    expect(AdelanteEHR.sendStaffMessage(pid, "Anita Brooks", "")).toBeUndefined();
  });
});

// ---- §Part 2 message flagging (human-applied consent gate) ----
describe("care message Part 2 flagging", () => {
  const pid = AdelanteEHR.listPatients()[0]!.id;

  it("flags and unflags with audit, gated to write-level messaging roles", () => {
    const m = AdelanteEHR.sendPatientMessage(pid, "flag me")!;
    expect(AdelanteEHR.flagMessageAsSud(pid, m.id, "Nobody", "billing")).toBe(false);
    expect(AdelanteEHR.flagMessageAsSud(pid, m.id, "Christi", "ecm_provider")).toBe(true);
    const flagged = AdelanteEHR.listCareMessages(pid).find((x) => x.id === m.id)!;
    expect(flagged.sudFlagged).toBe(true);
    expect(flagged.sudFlaggedBy).toBe("Christi");
    expect(flagged.sudFlaggedAt).toBeTruthy();
    const actions = AdelanteEHR.listAuditEvents().map((a) => a.action);
    expect(actions).toContain("care_message_sud_flagged");

    expect(AdelanteEHR.unflagMessageAsSud(pid, m.id, "Christi", "ecm_provider")).toBe(true);
    expect(AdelanteEHR.listCareMessages(pid).find((x) => x.id === m.id)!.sudFlagged).toBe(false);
    expect(AdelanteEHR.listAuditEvents().map((a) => a.action)).toContain("care_message_sud_unflagged");
  });

  it("masks the body for a role failing the SUD consent check, restores on unflag", () => {
    const patient = AdelanteEHR.getPatient(pid)!;
    const m = AdelanteEHR.sendPatientMessage(pid, "secret content")!;
    AdelanteEHR.flagMessageAsSud(pid, m.id, "Christi", "ecm_provider");
    const cur = () => AdelanteEHR.listCareMessages(pid).find((x) => x.id === m.id)!;

    const gated = canAccess("ecm_provider", "screeners_sud", patient).locked;
    expect(isMessageBodyMasked(cur(), "ecm_provider", patient)).toBe(gated);
    expect(visibleMessageBody(cur(), "ecm_provider", patient)).toBe(
      gated ? MASKED_MESSAGE_BODY : "secret content",
    );
    // pmhnp has un-gated read on screeners_sud — always sees the body.
    expect(visibleMessageBody(cur(), "pmhnp", patient)).toBe("secret content");

    AdelanteEHR.unflagMessageAsSud(pid, m.id, "Christi", "ecm_provider");
    expect(visibleMessageBody(cur(), "ecm_provider", patient)).toBe("secret content");
  });

  it("patient self-flag at send time masks identically to a staff flag", () => {
    const patient = AdelanteEHR.getPatient(pid)!;
    const m = AdelanteEHR.sendPatientMessage(pid, "self flagged content", true)!;
    const cur = () => AdelanteEHR.listCareMessages(pid).find((x) => x.id === m.id)!;

    expect(cur().sudFlagged).toBe(true);
    expect(cur().sudFlaggedByPatient).toBe(true);
    expect(cur().sudFlaggedBy).toBe(`${patient.firstName} ${patient.lastName}`);
    expect(cur().sudFlaggedAt).toBeTruthy();

    // Exact same masking check as the staff-flagged path.
    const gated = canAccess("ecm_provider", "screeners_sud", patient).locked;
    expect(isMessageBodyMasked(cur(), "ecm_provider", patient)).toBe(gated);
    expect(visibleMessageBody(cur(), "ecm_provider", patient)).toBe(
      gated ? MASKED_MESSAGE_BODY : "self flagged content",
    );

    const selfFlagAudit = AdelanteEHR.listAuditEvents().filter(
      (a) => a.action === "care_message_sud_flagged" && (a.detail as any)?.messageId === m.id,
    );
    expect(selfFlagAudit.length).toBe(1);
    expect((selfFlagAudit[0].detail as any).selfFlagged).toBe(true);

    // Staff can still override a patient self-flag; provenance becomes theirs.
    expect(AdelanteEHR.unflagMessageAsSud(pid, m.id, "Christi", "ecm_provider")).toBe(true);
    expect(cur().sudFlagged).toBe(false);
    expect(cur().sudFlaggedByPatient).toBeUndefined();
    expect(visibleMessageBody(cur(), "ecm_provider", patient)).toBe("self flagged content");
  });

  it("does not flag when the patient opts out (default)", () => {
    const m = AdelanteEHR.sendPatientMessage(pid, "ordinary message")!;
    expect(m.sudFlagged).toBeUndefined();
    expect(m.sudFlaggedByPatient).toBeUndefined();
  });

  it("keeps the patient_message notification body generic", () => {
    const cmPid = AdelanteEHR.listPatients().find((x) => x.caseManagerId === "cm1")!.id;
    AdelanteEHR.sendPatientMessage(cmPid, "do not echo this text");
    const notes = AdelanteEHR.listNotificationsFor("Lupita Sanchez, MSW", "ecm_provider").filter(
      (n) => n.category === "patient_message",
    );
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.body).toBe("A patient sent a message to their care team.");
      expect(n.body).not.toContain("do not echo");
    }
  });

  it("adds an un-gated backstop notification when a self-flag would blind the case manager", () => {
    const gatedPatient = AdelanteEHR.listPatients().find(
      (x) => canAccess("ecm_provider", "screeners_sud", x).locked,
    )!;
    const before = AdelanteEHR.listNotificationsFor("nobody", "therapist").length;
    AdelanteEHR.sendPatientMessage(gatedPatient.id, "sensitive ask", true);
    const after = AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
      (n) => n.category === "patient_message" && n.patientId === gatedPatient.id,
    );
    expect(after.length).toBeGreaterThan(0);
    expect(AdelanteEHR.listNotificationsFor("nobody", "therapist").length).toBeGreaterThan(before);
    expect(after.at(-1)!.body).toBe("A patient sent a message to their care team.");
  });

  it("does not add the backstop when the case manager is not gated for that patient", () => {
    const openPatient = AdelanteEHR.listPatients().find(
      (x) => !canAccess("ecm_provider", "screeners_sud", x).locked,
    )!;
    const before = AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
      (n) => n.patientId === openPatient.id,
    ).length;
    AdelanteEHR.sendPatientMessage(openPatient.id, "sensitive ask", true);
    const after = AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
      (n) => n.patientId === openPatient.id,
    ).length;
    expect(after).toBe(before);
  });

  // ---- Thread 1: therapist is un-gated for screeners_sud everywhere ----
  it("therapist has unconditional screeners_sud access, mirroring pmhnp", () => {
    for (const p of AdelanteEHR.listPatients()) {
      expect(canAccess("therapist", "screeners_sud", p).locked).toBe(false);
      expect(canAccess("pmhnp", "screeners_sud", p).locked).toBe(false);
    }
    expect(canAccess("therapist", "screeners_sud", undefined).locked).toBe(false);
    // Reads through the shared check used by message masking too.
    const gp = AdelanteEHR.listPatients()[0]!;
    const m = AdelanteEHR.sendPatientMessage(gp.id, "therapist can read this", true)!;
    const cur = AdelanteEHR.listCareMessages(gp.id).find((x) => x.id === m.id)!;
    expect(isMessageBodyMasked(cur, "therapist", gp)).toBe(false);
    expect(visibleMessageBody(cur, "therapist", gp)).toBe("therapist can read this");
  });

  // ---- Thread 2: staff-initiated (retroactive) flag backstop ----
  it("staff flag on a gated patient notifies the case manager (distinct copy) plus a backstop", () => {
    const gated = AdelanteEHR.listPatients().find(
      (x) => canAccess("ecm_provider", "screeners_sud", x).locked && x.caseManagerId,
    )!;
    const cmName = AdelanteEHR.listCaseManagers().find((c) => c.id === gated.caseManagerId)!.name;
    const m = AdelanteEHR.sendStaffMessage(gated.id, "Dr. Bagga", "clinical note to patient")!;
    const cmBefore = AdelanteEHR.listNotificationsFor(cmName, "ecm_provider").length;
    const thBefore = AdelanteEHR.listNotificationsFor("nobody", "therapist").length;

    AdelanteEHR.flagMessageAsSud(gated.id, m.id, "Dr. Bagga", "pmhnp");

    const all = AdelanteEHR.listNotificationsFor(cmName, "ecm_provider");
    expect(all.length).toBeGreaterThan(cmBefore);
    const visibility = all.filter((n) => n.body.includes("flagged for Part 2 protection"));
    expect(visibility.length).toBeGreaterThan(0);
    expect(AdelanteEHR.listNotificationsFor("nobody", "therapist").length).toBeGreaterThan(thBefore);
  });

  it("does not self-notify the case manager who did the flagging, and never notifies on unflag", () => {
    const gated = AdelanteEHR.listPatients().find(
      (x) => canAccess("ecm_provider", "screeners_sud", x).locked && x.caseManagerId,
    )!;
    const cmName = AdelanteEHR.listCaseManagers().find((c) => c.id === gated.caseManagerId)!.name;
    const m = AdelanteEHR.sendStaffMessage(gated.id, cmName, "note")!;
    const before = AdelanteEHR.listNotificationsFor(cmName, "ecm_provider").length;
    AdelanteEHR.flagMessageAsSud(gated.id, m.id, cmName, "ecm_provider");
    expect(AdelanteEHR.listNotificationsFor(cmName, "ecm_provider").length).toBe(before);

    const thBefore = AdelanteEHR.listNotificationsFor("nobody", "therapist").length;
    AdelanteEHR.unflagMessageAsSud(gated.id, m.id, cmName, "ecm_provider");
    expect(AdelanteEHR.listNotificationsFor("nobody", "therapist").length).toBe(thBefore);
    expect(AdelanteEHR.listNotificationsFor(cmName, "ecm_provider").length).toBe(before);
  });

  it("produces no flag notifications when the case manager is not gated", () => {
    const open = AdelanteEHR.listPatients().find(
      (x) => !canAccess("ecm_provider", "screeners_sud", x).locked,
    )!;
    const m = AdelanteEHR.sendStaffMessage(open.id, "Dr. Bagga", "note")!;
    const count = () =>
      AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
        (n) => n.patientId === open.id,
      ).length;
    const before = count();
    AdelanteEHR.flagMessageAsSud(open.id, m.id, "Dr. Bagga", "pmhnp");
    expect(count()).toBe(before);
  });

  // ---- Backstop selection is derived from the RBAC matrix ----
  it("selects a backstop that is genuinely un-gated and is never the flagger's own role", () => {
    const gated = AdelanteEHR.listPatients().find(
      (x) => canAccess("ecm_provider", "screeners_sud", x).locked && x.caseManagerId,
    )!;
    // Only roles that pass the SAME screeners_sud check may be a backstop.
    expect(canAccess("ecm_provider", "screeners_sud", gated).locked).toBe(true);
    expect(canAccess("peer_specialist", "screeners_sud", gated).locked).toBe(true);
    expect(canAccess("therapist", "screeners_sud", gated).locked).toBe(false);
    expect(canAccess("pmhnp", "screeners_sud", gated).locked).toBe(false);

    // Flagged by a therapist → backstop must fall through to pmhnp.
    const m1 = AdelanteEHR.sendStaffMessage(gated.id, "Dr. Marisol Reyes", "note a")!;
    const thBefore = AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
      (n) => n.patientId === gated.id,
    ).length;
    const npBefore = AdelanteEHR.listNotificationsFor("nobody", "pmhnp").filter(
      (n) => n.patientId === gated.id,
    ).length;
    AdelanteEHR.flagMessageAsSud(gated.id, m1.id, "Dr. Marisol Reyes", "therapist");
    expect(
      AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
        (n) => n.patientId === gated.id,
      ).length,
    ).toBe(thBefore);
    expect(
      AdelanteEHR.listNotificationsFor("nobody", "pmhnp").filter((n) => n.patientId === gated.id)
        .length,
    ).toBeGreaterThan(npBefore);

    // Flagged by a pmhnp → backstop resolves to therapist (un-gated per policy).
    const m2 = AdelanteEHR.sendStaffMessage(gated.id, "Dr. Bagga", "note b")!;
    const thBefore2 = AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
      (n) => n.patientId === gated.id,
    ).length;
    AdelanteEHR.flagMessageAsSud(gated.id, m2.id, "Dr. Bagga", "pmhnp");
    expect(
      AdelanteEHR.listNotificationsFor("nobody", "therapist").filter(
        (n) => n.patientId === gated.id,
      ).length,
    ).toBeGreaterThan(thBefore2);
  });
});
