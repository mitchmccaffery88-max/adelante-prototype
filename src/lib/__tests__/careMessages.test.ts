import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";

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
    expect(canAccess("case_manager", "patient_messaging").level).toBe("write");
    expect(canAccess("therapist", "patient_messaging").level).toBe("write");
    expect(canAccess("pmhnp", "patient_messaging").level).toBe("write");
    expect(canAccess("peer_specialist", "patient_messaging").level).toBe("read");
    expect(canAccess("billing", "patient_messaging").locked).toBe(true);
  });

  it("ignores empty message bodies", () => {
    const pid = patientId();
    expect(AdelanteEHR.sendPatientMessage(pid, "   ")).toBeUndefined();
    expect(AdelanteEHR.sendStaffMessage(pid, "Anita Brooks", "")).toBeUndefined();
  });
});
