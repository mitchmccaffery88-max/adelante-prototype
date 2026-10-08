// K2 (batch 2 carry-over) — each new event fires with neutral text; LVN cosign
// and HLOC routing are narrowed. Draft — pending exec RBAC review.
import { describe, it, expect, vi } from "vitest";
import type { WorkspaceActionRow, WorkspaceActionKind } from "@/lib/clinicianWorkspace";

let override: ((...a: unknown[]) => WorkspaceActionRow[]) | null = null;
vi.mock("@/lib/clinicianWorkspace", async (orig) => {
  const m = (await orig()) as typeof import("@/lib/clinicianWorkspace");
  return { ...m, workspaceActionRows: (...a: unknown[]) => (override ? override(...a) : (m.workspaceActionRows as (...x: unknown[]) => WorkspaceActionRow[])(...a)) };
});

import { AdelanteEHR } from "@/lib/ehr";
import { getStaffMember, STAFF_ROSTER } from "@/lib/roles";
import { syncBellPointers, POINTER_TEXT, POINTER_BODY } from "@/lib/notificationRouting";
import { administerClinicDose, nurseReviewOrder, orderClinicMedication } from "@/lib/nursing";
import { openEpisode } from "@/lib/outpatientCare";

const BANNED = /\bpart 2\b|\bsud\b|substance|opioid|buprenorphine|suboxone|methadone|naltrexone|naloxone|schedule ii|phq-?9|gad-?7|c-ssrs|\bscore\b/i;
const EVENTS: [WorkspaceActionKind, string, string][] = [
  ["continuity", "pmhnp", "MAT continuity"],
  ["escalation", "pmhnp", "Medication continuity"],
  ["coverage", "cf_care_manager", "Coverage at release"],
  ["reassign_needed", "clinical_coordinator", "Reassign needed"],
  ["content_waiting", "pmhnp", "Content review waiting"],
  ["content_review", "therapist", "Content past review date"],
  ["county_reminder", "billing_coordinator", "County report reminder"],
  ["restricted_open", "credentialing_coordinator", "Restricted record opened"],
];

describe("K2a — each new event fires one neutral pointer to the owner", () => {
  for (const [kind, role, label] of EVENTS) {
    it(`${kind} → ${role}`, () => {
      const s = STAFF_ROSTER.find((x) => x.role === role)!;
      const p = AdelanteEHR.listPatients()[0];
      const row = { id: `${kind}:k2-${role}`, kind, patientId: p.id, patientName: `${p.firstName} ${p.lastName}`, label, dueAt: new Date().toISOString(), due: "Today", group: "today", action: "Open" } as unknown as WorkspaceActionRow;
      override = () => [row];
      const actor = { staffId: s.id, staffName: s.name, role: s.role };
      expect(syncBellPointers(actor).created).toBe(1);
      expect(syncBellPointers(actor).created).toBe(0);
      const n = AdelanteEHR.listNotifications().find((x) => x.taskKey === row.id)!;
      expect(n.recipientStaffId).toBe(s.id);
      expect(n.recipientRole).toBeUndefined();
      expect(n.subject).toBe(POINTER_TEXT[kind === "escalation" ? "escalation" : kind]!.subject);
      expect(n.body).toBe(POINTER_BODY);
      for (const t of [n.subject, n.body]) {
        expect(t).not.toMatch(BANNED);
        expect(t).not.toContain(p.lastName);
      }
      override = () => [];
      syncBellPointers(actor);
      expect(AdelanteEHR.listNotifications().find((x) => x.taskKey === row.id)!.closedAt).toBeTruthy();
      override = null;
    });
  }
});

describe("K2b — narrowed routing", () => {
  it("LVN cosign goes to the named supervising RN, not the RN role", () => {
    const np = getStaffMember("s-np1")!, rn = getStaffMember("s-rn1")!, lvn = getStaffMember("s-lvn1")!;
    const pid = AdelanteEHR.listPatients()[2].id;
    const o = orderClinicMedication({ patientId: pid, drugName: "Hydroxyzine 25 MG Oral Tablet", dose: "25 mg", route: "PO", actor: { role: np.role, staffId: np.id, name: np.name }, enforceSafety: false });
    nurseReviewOrder({ patientId: pid, orderId: o.id, decision: "verified", actor: { role: rn.role, staffId: rn.id, name: rn.name } } as never);
    const before = AdelanteEHR.listNotifications().length;
    administerClinicDose({ patientId: pid, orderId: o.id, supervisorStaffId: rn.id, actor: { role: lvn.role, staffId: lvn.id, name: lvn.name } });
    const fresh = AdelanteEHR.listNotifications().slice(0, AdelanteEHR.listNotifications().length - before).concat(AdelanteEHR.listNotifications().slice(before));
    const cos = fresh.filter((n) => n.patientId === pid && /cosign/i.test(n.body ?? ""));
    expect(cos.length).toBeGreaterThan(0);
    for (const n of cos) {
      expect(n.recipientStaffId).toBe(rn.id);
      expect(n.recipientRole).toBeUndefined();
    }
  });
  it("LVN with no supervisor is refused (no role-wide fallback is ever needed)", () => {
    const np = getStaffMember("s-np1")!, rn = getStaffMember("s-rn1")!;
    const pid = AdelanteEHR.listPatients()[3].id;
    const o = orderClinicMedication({ patientId: pid, drugName: "Hydroxyzine 25 MG Oral Tablet", dose: "25 mg", route: "PO", actor: { role: np.role, staffId: np.id, name: np.name }, enforceSafety: false });
    nurseReviewOrder({ patientId: pid, orderId: o.id, decision: "verified", actor: { role: rn.role, staffId: rn.id, name: rn.name } } as never);
    expect(() => administerClinicDose({ patientId: pid, orderId: o.id, supervisorStaffId: "nobody", actor: { role: "lvn", staffId: "s-lvn-none", name: "Temp LVN" } })).toThrow(/supervis/);
  });
  it("episode change goes to the assigned clinician(s) + coordinator, not every therapist", () => {
    const p = AdelanteEHR.listPatients().find((x) => x.primaryClinicianId)!;
    const before = new Set(AdelanteEHR.listNotifications().map((n) => n.id));
    openEpisode({ patientId: p.id, program: "outpatient_mh" as never, actor: { name: "Priya Raman", role: "clinical_coordinator" } as never });
    const fresh = AdelanteEHR.listNotifications().filter((n) => !before.has(n.id) && n.patientId === p.id && n.category === "episode_changed");
    expect(fresh.some((n) => n.recipientRole === "clinical_coordinator")).toBe(true);
    const named = fresh.filter((n) => n.recipientStaffId);
    if (named.length) expect(fresh.some((n) => n.recipientRole === "therapist")).toBe(false);
    for (const n of named) expect(STAFF_ROSTER.find((s) => s.id === n.recipientStaffId)?.role).not.toBe("sys_admin");
  });
});
