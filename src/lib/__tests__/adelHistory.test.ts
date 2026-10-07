import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import {
  ADEL_HISTORY_COPY, _resetAdelHistoryForTests, adelDeletionStubs, adelRecallLine, clearAdelHistory,
  deleteAdelThread, getAdelThread, listAdelThreads, purgeExpiredAdelThreads, saveAdelTurn, shareAdelThread,
} from "@/lib/adelHistory";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { detectCrisisLanguage } from "@/lib/crisisTextDetection";
import { visibleMessageBody } from "@/lib/careMessageMasking";
import * as adelHistory from "@/lib/adelHistory";

const luis = () => demoScenarioPatientId("sud_consented")!;
const me = () => ({ kind: "patient" as const, patientId: luis() });

describe("Adel chat persistence", () => {
  beforeEach(() => _resetAdelHistoryForTests());

  it("persists turns across sessions and titles neutrally", () => {
    const t = saveAdelTurn(me(), undefined, { role: "user", content: "How do I get a bus pass for my appointment?" });
    saveAdelTurn(me(), t.id, { role: "assistant", content: "Let's look." });
    // a later "session" — fresh lookup by owner
    const again = listAdelThreads(me());
    expect(again).toHaveLength(1);
    expect(again[0]!.turns).toHaveLength(2);
    expect(again[0]!.title.en).toBe("Getting to appointments");
    expect(again[0]!.title.es).toBe("Cómo llegar a las citas");
  });

  it("recalls only the owner's own last topic (EN/ES)", () => {
    const at = new Date(Date.now() - 7 * 86_400_000).toISOString();
    saveAdelTurn(me(), undefined, { role: "user", content: "I need a bus pass", at });
    expect(adelRecallLine(me(), "en")).toBe("Welcome back. Last week you mentioned the bus pass — did that work out?");
    expect(adelRecallLine(me(), "es")).toContain("el pase de autobús");
    expect(adelRecallLine({ kind: "patient", patientId: "someone-else" }, "en")).toBeUndefined();
  });

  it("delete-one and delete-all leave content-free stubs", () => {
    const a = saveAdelTurn(me(), undefined, { role: "user", content: "sleep is hard" });
    saveAdelTurn(me(), undefined, { role: "user", content: "job interview" });
    expect(deleteAdelThread(me(), a.id)).toBe(true);
    expect(listAdelThreads(me())).toHaveLength(1);
    expect(clearAdelHistory(me())).toBe(1);
    expect(listAdelThreads(me())).toHaveLength(0);
    const stubs = adelDeletionStubs();
    expect(stubs.map((s) => s.reason)).toEqual(["patient_deleted", "patient_cleared_all"]);
    expect(JSON.stringify(stubs)).not.toMatch(/sleep|job/);
    const audits = JSON.stringify(AdelanteEHR.getAuditLog().filter((e) => e.action.startsWith("adel_")));
    expect(audits).not.toMatch(/sleep is hard|job interview/);
  });

  it("auto-deletes after 90 days with a retention stub", () => {
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString();
    saveAdelTurn(me(), undefined, { role: "user", content: "housing", at: old });
    saveAdelTurn(me(), undefined, { role: "user", content: "food" });
    expect(purgeExpiredAdelThreads()).toBe(1);
    expect(listAdelThreads(me())).toHaveLength(1);
    expect(adelDeletionStubs()[0]!.reason).toBe("retention_expired");
  });

  it("has no staff read path and isolates advocates", () => {
    saveAdelTurn(me(), undefined, { role: "user", content: "bus pass" });
    const exported = Object.keys(adelHistory);
    expect(exported.some((k) => /staff/i.test(k))).toBe(false);
    expect(listAdelThreads({ kind: "advocate", linkId: luis() })).toHaveLength(0);
    const adv = saveAdelTurn({ kind: "advocate", linkId: "link-1" }, undefined, { role: "user", content: "my own stress" });
    expect(getAdelThread(me(), adv.id)).toBeUndefined();
    expect(listAdelThreads(me())).toHaveLength(1);
  });

  it("share sends a summary only to the care team, via disclose() for SUD chats, masked for non-SUD roles", () => {
    const t = saveAdelTurn(me(), undefined, { role: "user", content: "I keep thinking about drinking and I need a bus pass" });
    expect(t.part2).toBe(true);
    const before = listDisclosureLog().length;
    const r = shareAdelThread(luis(), t.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.disclosed).toBe(true);
    expect(listDisclosureLog().length).toBe(before + 1);
    expect(listDisclosureLog()[0]!.channel).toBe("adel_share");
    const msg = AdelanteEHR.listCareMessages(luis()).find((m) => m.id === r.messageId)!;
    expect(msg.body).toContain("summary, Simulated");
    expect(msg.body).not.toMatch(/drinking|keep thinking/);
    expect(msg.sudFlagged).toBe(true);
    const p = AdelanteEHR.getPatient(luis())!;
    expect(visibleMessageBody(msg, "billing" as never, p)).not.toBe(msg.body);
  });

  it("non-SUD share skips disclosure", () => {
    const t = saveAdelTurn(me(), undefined, { role: "user", content: "help with groceries" });
    const r = shareAdelThread(luis(), t.id);
    expect(r.ok && !r.disclosed).toBe(true);
  });

  it("crisis detection is unchanged and independent of history", () => {
    expect(detectCrisisLanguage("I want to kill myself").matched).toBe(true);
  });

  it("EN and ES copy cover the same keys", () => {
    expect(Object.keys(ADEL_HISTORY_COPY.es).sort()).toEqual(Object.keys(ADEL_HISTORY_COPY.en).sort());
    expect(ADEL_HISTORY_COPY.en.privacy).toBe("Your chats with Adel are private. Your care team sees them only if you share them, or if you might be in danger.");
  });
});
