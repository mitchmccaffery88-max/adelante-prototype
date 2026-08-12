import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { validateContact } from "@/lib/frontDoor";

describe("front-door contact validation", () => {
  it("accepts real emails and phones", () => {
    expect(validateContact("a@b.com")).toMatchObject({ valid: true, kind: "email" });
    expect(validateContact("(559) 555-0123")).toMatchObject({ valid: true, kind: "phone" });
    expect(validateContact("15595550123")).toMatchObject({ valid: true, kind: "phone" });
  });
  it("rejects empty and malformed values", () => {
    for (const v of ["", "   ", "a@b", "not a contact", "555-0123"]) {
      expect(validateContact(v).valid, v).toBe(false);
    }
  });
});

describe("community inquiry store", () => {
  it("stores an inquiry outside the patient record and dispositions it", () => {
    const before = AdelanteEHR.listCommunityInquiries({ includeResolved: true }).length;
    const row = AdelanteEHR.createCommunityInquiry({
      body: "Looking for housing help for my brother",
      contact: "a@b.com",
      contactKind: "email",
    })!;
    expect(row.status).toBe("new");
    expect(row.crisisFlagged).toBe(false);
    expect(AdelanteEHR.listCommunityInquiries({ includeResolved: true }).length).toBe(before + 1);
    // Not attached to any patient chart.
    expect(AdelanteEHR.listPatients().some((p) => JSON.stringify(p).includes(row.id))).toBe(false);

    expect(AdelanteEHR.dispositionCommunityInquiry(row.id, "contacted", "Priya Raman")).toBe(true);
    expect(AdelanteEHR.dispositionCommunityInquiry(row.id, "resolved", "Priya Raman")).toBe(true);
    const after = AdelanteEHR.listCommunityInquiries({ includeResolved: true }).find(
      (r) => r.id === row.id,
    )!;
    expect(after.status).toBe("resolved");
    expect(after.dispositionBy).toBe("Priya Raman");
  });

  it("requires body and contact", () => {
    expect(AdelanteEHR.createCommunityInquiry({ body: " ", contact: "a@b.com", contactKind: "email" })).toBeUndefined();
    expect(AdelanteEHR.createCommunityInquiry({ body: "x", contact: "  ", contactKind: "email" })).toBeUndefined();
  });

  it("records a crisis-flagged inquiry alongside a real anonymous staff alert", () => {
    const beforeAlerts = AdelanteEHR.listAnonymousCrisisAlerts().length;
    const row = AdelanteEHR.createCommunityInquiry({
      body: "I want to kill myself",
      contact: "5595550123",
      contactKind: "phone",
      crisisFlagged: true,
      patternIds: ["kill_myself"],
    })!;
    AdelanteEHR.raiseAnonymousCrisisAlert({
      surface: "the front-door note",
      patternIds: ["kill_myself"],
      contact: "5595550123",
    });
    expect(row.crisisFlagged).toBe(true);
    const alerts = AdelanteEHR.listAnonymousCrisisAlerts();
    expect(alerts.length).toBe(beforeAlerts + 1);
    expect(alerts.some((a) => a.contact === "5595550123")).toBe(true);
  });
});
