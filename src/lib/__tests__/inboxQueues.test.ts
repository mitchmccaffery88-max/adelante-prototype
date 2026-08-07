// §Inbox — unsigned notes queue + provider request queue.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

const pid = () => AdelanteEHR.listPatients()[0].id;

describe("unsigned notes queue", () => {
  it("only lists the acting author's own drafts, oldest-first", () => {
    const p = pid();
    AdelanteEHR.addProgressNote(p, {
      clinicianId: "c-me",
      date: "2026-01-02T10:00:00.000Z",
      sessionType: "individual",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      status: "draft",
    });
    AdelanteEHR.addProgressNote(p, {
      clinicianId: "c-me",
      date: "2026-01-01T10:00:00.000Z",
      sessionType: "individual",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      status: "draft",
    });
    AdelanteEHR.addProgressNote(p, {
      clinicianId: "c-other",
      date: "2026-01-03T10:00:00.000Z",
      sessionType: "individual",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      status: "draft",
    });
    const mine = AdelanteEHR.listDraftNotesBy("c-me");
    expect(mine.length).toBe(2);
    expect(mine.every((r) => r.note.clinicianId === "c-me")).toBe(true);
    expect(mine[0].note.date < mine[1].note.date).toBe(true);
    expect(AdelanteEHR.listDraftNotesBy("c-other").length).toBe(1);
  });

  it("excludes signed notes", () => {
    const p = pid();
    AdelanteEHR.addProgressNote(p, {
      clinicianId: "c-signed",
      date: "2026-01-04T10:00:00.000Z",
      sessionType: "individual",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      status: "signed",
      signedBy: "Dr. Marisol Reyes",
      signedAt: "2026-01-04T11:00:00.000Z",
    });
    expect(AdelanteEHR.listDraftNotesBy("c-signed").length).toBe(0);
  });
});

describe("provider requests", () => {
  const make = () =>
    AdelanteEHR.createProviderRequest({
      patientId: pid(),
      requestType: "order_entry",
      context: "Enter the refill.",
      requestedBy: "Luz Herrera",
      requestedByRole: "ecm_provider",
    })!;

  it("requires non-empty context", () => {
    expect(
      AdelanteEHR.createProviderRequest({
        patientId: pid(),
        requestType: "question",
        context: "   ",
        requestedBy: "Luz Herrera",
        requestedByRole: "ecm_provider",
      }),
    ).toBeUndefined();
  });

  it("claiming is one-shot — a second claim is rejected without a takeover path", () => {
    const r = make();
    expect(AdelanteEHR.claimProviderRequest(r.id, "Dr. R. Bagga", "pmhnp")).toBe(true);
    expect(AdelanteEHR.claimProviderRequest(r.id, "Dr. Marisol Reyes", "therapist")).toBe(false);
    const after = AdelanteEHR.listProviderRequests().find((x) => x.id === r.id)!;
    expect(after.status).toBe("claimed");
    expect(after.assignedTo).toBe("Dr. R. Bagga");
  });

  it("release returns a claimed request to the unclaimed pool", () => {
    const r = make();
    AdelanteEHR.claimProviderRequest(r.id, "Dr. R. Bagga", "pmhnp");
    expect(AdelanteEHR.releaseProviderRequest(r.id, "Dr. R. Bagga", "pmhnp")).toBe(true);
    const after = AdelanteEHR.listProviderRequests().find((x) => x.id === r.id)!;
    expect(after.status).toBe("open");
    expect(after.assignedTo).toBeUndefined();
    expect(AdelanteEHR.claimProviderRequest(r.id, "Dr. Marisol Reyes", "therapist")).toBe(true);
  });

  it("completing notifies the ORIGINAL requester, once, with the outcome", () => {
    const r = make();
    AdelanteEHR.claimProviderRequest(r.id, "Dr. R. Bagga", "pmhnp");
    const before = new Set(AdelanteEHR.listNotifications().map((n) => n.id));
    expect(
      AdelanteEHR.completeProviderRequest(r.id, "Dr. R. Bagga", "pmhnp", "Refill sent."),
    ).toBe(true);
    const fresh = AdelanteEHR.listNotifications().filter((n) => !before.has(n.id));
    const hit = fresh.filter((n) => n.category === "provider_request_completed");
    expect(hit.length).toBe(1);
    expect(hit[0].recipientStaffId).toBe("Luz Herrera");
    expect(hit[0].body).toContain("Refill sent.");
    // Idempotent: completing again does nothing and re-notifies nobody.
    const before2 = AdelanteEHR.listNotifications().length;
    expect(AdelanteEHR.completeProviderRequest(r.id, "Dr. R. Bagga", "pmhnp")).toBe(false);
    expect(AdelanteEHR.listNotifications().length).toBe(before2);
  });

  it("an unclaimed request can be completed directly and still reports back", () => {
    const r = make();
    expect(AdelanteEHR.completeProviderRequest(r.id, "Dr. R. Bagga", "pmhnp")).toBe(true);
    const after = AdelanteEHR.listProviderRequests().find((x) => x.id === r.id)!;
    expect(after.assignedTo).toBe("Dr. R. Bagga");
    expect(
      AdelanteEHR.listNotificationsFor("Luz Herrera").some(
        (n) => n.category === "provider_request_completed",
      ),
    ).toBe(true);
  });
});
