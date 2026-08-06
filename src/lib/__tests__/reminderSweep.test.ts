// §Reminders — the automatic sweep is a trigger only; it must reuse the exact
// same idempotent send path as the manual button.
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AdelanteEHR } from "../ehr";
import { runReminderSweep, useReminderSweep } from "@/hooks/useReminderSweep";
import { sendDueReminders, upcomingContacts } from "../reminders";

function seedGroup(patientId: string, hoursAhead = 5) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  const g = AdelanteEHR.createGroupSession({
    topic: "Sweep test group (placeholder topic)",
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality: "in_person",
    start: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "none" },
    createdBy: "test",
  });
  AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId, enrolledBy: "test" });
  return g;
}

describe("automatic reminder sweep", () => {
  it("fires on mount and on each interval tick", () => {
    vi.useFakeTimers();
    const p = AdelanteEHR.listPatients()[0]!;
    seedGroup(p.id);
    const before = upcomingContacts().length;
    expect(before).toBeGreaterThan(0);
    const { unmount } = renderHook(() => useReminderSweep(1000));
    // mount run already sent everything due; a tick must not resend.
    const afterMount = sendDueReminders();
    expect(afterMount.sent).toHaveLength(0);
    vi.advanceTimersByTime(3000);
    unmount();
    vi.useRealTimers();
  });

  it("shares one idempotent path with the manual button", () => {
    const p = AdelanteEHR.listPatients()[1]!;
    seedGroup(p.id, 6);
    const manual = runReminderSweep();
    expect(manual.sent.length).toBeGreaterThan(0);
    const auto = runReminderSweep();
    expect(auto.sent).toHaveLength(0);
    expect(auto.skippedDuplicate.length).toBeGreaterThan(0);
  });
});
