import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR } from "@/lib/ehr";
import { recordDailyCheckIn, startCravingLog } from "@/lib/selfTracking";
import { checkInSummary } from "@/lib/caseloadReview";
import { moodCheckInDayCount } from "@/lib/moodCheckInCount";
import { isMessageBodyMasked } from "@/lib/careMessageMasking";

describe("§4 (d) mood check-in count for case managers", () => {
  it("staff summary gets a number only — no emotions, reasons, cravings", () => {
    const p = AdelanteEHR.listPatients()[1];
    recordDailyCheckIn(p.id, { emotions: ["depressed", "craving"], reasonId: "family" as never });
    try { startCravingLog(p.id, { intensity: 9, note: "CRAVE-SECRET" } as never); } catch { /* shape varies */ }
    const s = checkInSummary(p, "cf_care_manager");
    expect(s.moodDaysThisWeek).toBe(1);
    expect(moodCheckInDayCount(p.id, "2000-01-01", "2999-12-31")).toBe(1);
    const json = JSON.stringify(s);
    for (const bad of ["depressed", "craving", "family", "CRAVE-SECRET", "emotion"]) expect(json).not.toContain(bad);
    expect(Object.keys(s).sort()).toEqual(["daysThisWeek", "followUpSuggested", "moodDaysThisWeek", "trend"]);
  });
  it("the count module exposes one number-returning function and staff screens never import the store", () => {
    const src = readFileSync("src/lib/moodCheckInCount.ts", "utf8");
    expect(src.match(/^export /gm)?.length).toBe(1);
    for (const f of ["src/routes/caseload-review.tsx", "src/lib/caseloadReview.ts"])
      expect(readFileSync(f, "utf8")).not.toMatch(/@\/lib\/selfTracking/);
  });
});

describe("B8 merged care-team thread", () => {
  it("one thread holds peer + therapist replies; SUD-flagged stays masked for failing roles", () => {
    const p = AdelanteEHR.listPatients()[2];
    AdelanteEHR.setConsent(p.id, "part2Sud", false);
    AdelanteEHR.sendStaffMessage(p.id, "Andre", "Checking in from peer support.", "peer_specialist");
    AdelanteEHR.sendStaffMessage(p.id, "Dr. Reyes", "See you Thursday.", "therapist");
    const sud = AdelanteEHR.sendPatientMessage(p.id, "private recovery question", true)!;
    const thread = AdelanteEHR.listCareMessages(p.id);
    expect(new Set(thread.map((m) => m.threadPatientId))).toEqual(new Set([p.id]));
    expect(thread.some((m) => m.authorRole === "peer_specialist")).toBe(true);
    expect(thread.some((m) => m.authorRole === "therapist")).toBe(true);
    expect(isMessageBodyMasked(sud, "cf_care_manager", p)).toBe(true);
  });
  it("patient home no longer links to a separate peer chat", () => {
    expect(readFileSync("src/components/PatientHome.tsx", "utf8")).not.toContain("peer-chat-entry");
  });
});
