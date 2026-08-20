// §Patient portal Tier 1 Build B — behaviour + privacy regression cover.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  __resetSelfTracking,
  completeCravingLog,
  dailyCheckInDayKeys,
  isResourceSaved,
  listCravingLogs,
  listLapses,
  recordDailyCheckIn,
  recordLapse,
  savedResourceIds,
  startCravingLog,
  todaysCheckIn,
  toggleSavedResource,
  LAPSE_NEXT_STEPS,
} from "@/lib/selfTracking";
import { checkInStreakFrom, dayKey } from "@/lib/checkInStreak";
import { NEXT_STEP_DESTINATIONS } from "@/components/patient/SlipSupportFlow";

beforeEach(() => __resetSelfTracking());

describe("daily check-in", () => {
  it("stores one entry per day and replaces it on re-save", () => {
    recordDailyCheckIn("p1", { emotions: ["anxious"] });
    recordDailyCheckIn("p1", { emotions: ["hopeful", "tired" as never], reasonId: "didnt_sleep" });
    expect(dailyCheckInDayKeys("p1")).toHaveLength(1);
    expect(todaysCheckIn("p1")?.reasonId).toBe("didnt_sleep");
  });

  it("is skippable — no reason is a valid check-in", () => {
    const c = recordDailyCheckIn("p1", { emotions: ["lonely"] });
    expect(c.reasonId).toBeUndefined();
  });

  it("contributes to the real check-in streak alongside doses and quick checks", () => {
    const now = new Date(2026, 4, 20, 9);
    const y = new Date(2026, 4, 19, 9);
    recordDailyCheckIn("p1", { emotions: ["craving"], now });
    const s = checkInStreakFrom(
      {
        doseSelfReportDates: [dayKey(y)],
        quickCheckCompletedAt: [],
        dailyCheckInDayKeys: dailyCheckInDayKeys("p1"),
      },
      now,
    );
    expect(s.days).toBe(2);
    expect(s.checkedInToday).toBe(true);
  });
});

describe("craving log", () => {
  it("records a before rating, then closes with the after rating", () => {
    const log = startCravingLog("p1", 8);
    completeCravingLog("p1", log.id, { levelAfter: 3, surfCompleted: true });
    const [saved] = listCravingLogs("p1");
    expect(saved?.levelBefore).toBe(8);
    expect(saved?.levelAfter).toBe(3);
    expect(saved?.surfCompleted).toBe(true);
    expect(saved?.endedAt).toBeTruthy();
  });

  it("clamps ratings to 0–10", () => {
    const log = startCravingLog("p1", 42);
    expect(log.levelBefore).toBe(10);
  });
});

describe("lapse record", () => {
  it("stores the reflective answers and the chosen next step", () => {
    recordLapse("p1", {
      contributors: ["stress", "alone"],
      helpedBefore: ["meeting"],
      nextStep: "find_meeting",
    });
    const [l] = listLapses("p1");
    expect(l?.contributors).toEqual(["stress", "alone"]);
    expect(l?.nextStep).toBe("find_meeting");
  });

  it("every next-step option routes to a real route file", () => {
    const routeFiles = readdirSync("src/routes");
    for (const opt of LAPSE_NEXT_STEPS) {
      const dest = NEXT_STEP_DESTINATIONS[opt.id];
      expect(dest, opt.id).toBeTruthy();
      const file = `${dest.to.replace(/^\//, "").replace(/\//g, ".") || "index"}.tsx`;
      const indexFile = file.replace(/\.tsx$/, ".index.tsx");
      expect(
        routeFiles.includes(file) || routeFiles.includes(indexFile),
        `${opt.id} -> ${dest.to}`,
      ).toBe(true);
    }
  });
});

describe("saved resources", () => {
  it("toggles on and off and is scoped per patient", () => {
    expect(toggleSavedResource("p1", "res_housing_1")).toBe(true);
    expect(isResourceSaved("p1", "res_housing_1")).toBe(true);
    expect(isResourceSaved("p2", "res_housing_1")).toBe(false);
    expect(toggleSavedResource("p1", "res_housing_1")).toBe(false);
    expect(savedResourceIds("p1")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The privacy promise printed on the slip flow, asserted structurally.
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const PATIENT_PRIVATE_CALLERS = [
  "src/lib/selfTracking.ts",
  // §Build A item 3 — pure emotion→reflection mapping for the check-in
  // summary screen; type-only patient-side consumer, no staff surface.
  "src/lib/checkInSummary.ts",
  "src/lib/__tests__/selfTracking.test.ts",
  "src/components/patient/DailyCheckInCard.tsx",
  "src/components/patient/RecoveryDateCard.tsx",
  "src/components/patient/CravingFlow.tsx",
  "src/components/patient/SlipSupportFlow.tsx",
  "src/components/patient/HomeDashboard.tsx",
  "src/components/patient/WeeklyRecap.tsx",
  "src/components/reentry/ResourceCard.tsx",
  "src/components/reentry/ResourceDetail.tsx",
  "src/components/reentry/SavedResources.tsx",
  "src/components/reentry/CommunityResourceCenter.tsx",
];

describe("patient-private tier", () => {
  it("no staff or admin surface imports the private store", () => {
    const offenders = walk("src")
      .filter((f) => !PATIENT_PRIVATE_CALLERS.includes(f.replace(/\\/g, "/")))
      .filter((f) => /from ["']@\/lib\/selfTracking["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the store has no audit sink and no clinical-record import", () => {
    const src = readFileSync("src/lib/selfTracking.ts", "utf8");
    expect(src).not.toMatch(/^import .*@\/lib\/ehr/m);
    expect(src).not.toMatch(/^\s*(let|const|function)\s+\w*[aA]uditSink/m);
  });
});
