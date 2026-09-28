import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

describe("notification audience guard", () => {
  it("a patient view never shows staff notifications, even with sys_admin acting", () => {
    const pid = AdelanteEHR.listPatients()[0]!.id;
    AdelanteEHR.notify({ recipientRole: "sys_admin", category: "note_void_request", subject: "Staff only", body: "x", patientId: pid });
    AdelanteEHR.notifyMember({ audience: "patient", recipientId: pid, subject: "Your visit is confirmed", body: "y" });
    const mine = AdelanteEHR.listMemberNotifications("patient", pid);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((n) => n.audience === "patient")).toBe(true);
    expect(mine.some((n) => n.subject === "Staff only")).toBe(false);
    expect(AdelanteEHR.listMemberNotifications("advocate", pid)).toHaveLength(0);
    // Staff lists never contain member rows.
    const staff = AdelanteEHR.listNotificationsFor("Admin", "sys_admin", "s-admin");
    expect(staff.some((n) => n.subject === "Staff only")).toBe(true);
    expect(staff.some((n) => n.audience === "patient")).toBe(false);
  });

  it("dedupeKey makes a notification idempotent per recipient and per list", () => {
    const k = `void:test:${Date.now()}`;
    AdelanteEHR.notify({ recipientRole: "clinical_coordinator", category: "note_void_request", subject: "Void", body: "b", dedupeKey: k });
    AdelanteEHR.notify({ recipientRole: "clinical_coordinator", category: "note_void_request", subject: "Void", body: "b", dedupeKey: k });
    AdelanteEHR.notify({ recipientStaffId: "s-cc1", category: "note_void_request", subject: "Void", body: "b", dedupeKey: k });
    const rows = AdelanteEHR.listNotificationsFor("Priya Raman", "clinical_coordinator", "s-cc1").filter((n) => n.dedupeKey === k);
    expect(rows).toHaveLength(1);
  });
});

describe("void request notifications", () => {
  it("a decided void no longer shows its request notification", () => {
    const k = (id: string, at: string) => `void:${id}:${at}`;
    const staff = () => AdelanteEHR.listNotificationsFor("Admin", "sys_admin", "s-admin").filter((n) => n.subject.startsWith("Void request —"));
    // The module seed requests two voids and approves one; only the open one remains.
    const open = AdelanteEHR.listPendingNoteVoids({ name: "Admin", role: "sys_admin", staffId: "s-admin" });
    const keys = new Set(open.map((v) => k(v.noteId, v.requestedAt)));
    expect(staff().every((n) => keys.has(n.dedupeKey ?? ""))).toBe(true);
    expect(staff().length).toBe(open.length);
  });
});
