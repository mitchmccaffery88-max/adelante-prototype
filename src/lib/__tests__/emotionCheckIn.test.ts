// Phase 6 — one private emotion check-in.
import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { AdelanteEHR } from "@/lib/ehr";
import { CHECK_IN_EMOTIONS, __resetSelfTracking, todaysCheckIn, checkInPostponed } from "@/lib/selfTracking";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";
import { applyPrivateUpdate } from "@/lib/privateSelfTrackingActions";
import { runAction } from "@/lib/actions/runAction";
import { checkInSummaryPlan } from "@/lib/checkInSummary";
import { checkInContextFrom } from "@/lib/patientCheckInContext";

const EMOJI = /\p{Extended_Pictographic}/u;

describe("emotion check-in", () => {
  beforeEach(() => __resetSelfTracking());

  it("offers the eleven emotions with local Fluent images and no typed emoji", () => {
    expect(CHECK_IN_EMOTIONS.map((e) => e.id)).toEqual(["anxious", "overwhelmed", "lonely", "hopeful", "angry", "depressed", "craving", "stressed", "exhausted", "calm", "okay"]);
    for (const e of CHECK_IN_EMOTIONS) {
      expect(existsSync(`public${e.image}`)).toBe(true);
      expect(e.label).not.toMatch(EMOJI);
      expect(CHECK_IN_COPY.es.emotions[e.id]).toBeTruthy();
    }
    expect(JSON.stringify(CHECK_IN_COPY)).not.toMatch(EMOJI);
    expect(readFileSync("public/emotions/LICENSE.txt", "utf8")).toMatch(/MIT/);
  });

  it("saves through the self-only action; audit carries no answers", () => {
    const id = AdelanteEHR.getCurrentPatientId()!;
    const before = AdelanteEHR.listAuditEvents().length;
    applyPrivateUpdate(id, { kind: "save", emotions: ["craving", "lonely"], reasonId: "old_triggers" });
    expect(todaysCheckIn(id)?.emotions).toEqual(["craving", "lonely"]);
    const added = AdelanteEHR.listAuditEvents().slice(before);
    expect(added).toHaveLength(1);
    expect(JSON.stringify(added)).not.toMatch(/craving|lonely|old_triggers/i);
  });

  it("Not now postpones without recording feelings", () => {
    const id = AdelanteEHR.getCurrentPatientId()!;
    applyPrivateUpdate(id, { kind: "postpone" });
    expect(checkInPostponed(id)).toBe(true);
    expect(todaysCheckIn(id)).toBeUndefined();
  });

  it("staff can never run the private update", () => {
    const p = AdelanteEHR.getPatient(AdelanteEHR.getCurrentPatientId()!);
    const r = runAction("patient_private_update", { role: "therapist" }, p, { args: [p!.id, { kind: "postpone" }] });
    expect(r.ok).toBe(false);
  });

  it("Craving leads with the timer; Calm and Okay rank lightest", () => {
    const plan = checkInSummaryPlan(["okay", "craving", "calm"], "es");
    expect(plan).toBeTruthy();
    expect(JSON.stringify(plan)).toMatch(/craving/);
    expect(JSON.stringify(checkInSummaryPlan(["calm"], "en"))).not.toMatch(EMOJI);
  });

  it("context projects only real scheduled items and hides hidden needs", () => {
    const now = new Date("2026-10-14T15:00:00Z");
    const ctx = checkInContextFrom({ appointments: [], refills: [], groups: [], patient: { id: "x", sdohPlan: { items: [{ id: "n1", need: "Housing", status: "open", visibleToPatient: false }] } } as never }, now);
    expect(ctx.items).toEqual([]);
  });
});
