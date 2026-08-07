import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

const patientId = () => AdelanteEHR.listPatients()[0].id;

describe("notification feed — Phase 1", () => {
  it("routes a cosign request to the eligible cosign role, not to a person", () => {
    const pid = patientId();
    const note = AdelanteEHR.addProgressNote(pid, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "s",
      objective: "o",
      assessment: "a",
      plan: "p",
    })!;
    AdelanteEHR.signProgressNote(pid, note.id, {
      signedBy: "Luz Herrera",
      role: "ecm_provider",
      attested: true,
      cosignRole: ["pmhnp"],
    });
    const forPmhnp = AdelanteEHR.listNotificationsFor("Dr. R. Bagga", "pmhnp");
    expect(forPmhnp.some((n) => n.category === "cosign_request" && n.linkRoute === "/cosign-inbox")).toBe(true);
    const forTherapist = AdelanteEHR.listNotificationsFor("Anita Brooks", "therapist");
    expect(forTherapist.some((n) => n.category === "cosign_request" && n.patientId === pid)).toBe(false);
  });

  it("notifies clinical_coordinator when a crisis is flagged", () => {
    const pid = patientId();
    AdelanteEHR.flagCrisis(pid, "Anita Brooks", "Ideation with plan disclosed");
    const rows = AdelanteEHR.listNotificationsFor("Priya Raman", "clinical_coordinator");
    expect(rows[0].category).toBe("crisis_flagged");
    expect(rows[0].linkRoute).toBe("/crisis-queue");
  });

  it("notifies only the assigned staff member for a task, not the whole role", () => {
    const pid = patientId();
    AdelanteEHR.createCaseTask({
      patientId: pid,
      assignedTo: "cm1",
      title: "Call patient",
      dueDate: "2026-08-01",
    });
    const mine = AdelanteEHR.listNotificationsFor("Lupita Sanchez, MSW", "ecm_provider");
    const task = mine.find((n) => n.category === "task_assigned");
    expect(task).toBeTruthy();
    expect(task!.recipientRole).toBeUndefined();
    const other = AdelanteEHR.listNotificationsFor("Luz Herrera", "ecm_provider");
    expect(other.some((n) => n.category === "task_assigned")).toBe(false);
  });

  it("marks one read without touching the others", () => {
    const rows = AdelanteEHR.listNotificationsFor("Priya Raman", "clinical_coordinator");
    const before = rows.filter((n) => !n.readAt).length;
    AdelanteEHR.markNotificationRead(rows[0].id, "Priya Raman");
    const after = AdelanteEHR.listNotificationsFor("Priya Raman", "clinical_coordinator");
    expect(after.filter((n) => !n.readAt).length).toBe(before - 1);
    AdelanteEHR.markAllNotificationsRead("Priya Raman", "clinical_coordinator");
    expect(
      AdelanteEHR.listNotificationsFor("Priya Raman", "clinical_coordinator").every((n) => n.readAt),
    ).toBe(true);
  });
});
