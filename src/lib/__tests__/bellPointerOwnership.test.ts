// Bell bug fix B1–B5 — each task pointer has one lifecycle owner; syncBellPointers
// only manages "workspace" pointers. Draft — pending exec RBAC review.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR, isNotificationReadBy } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";
import { syncBellPointers } from "@/lib/notificationRouting";
import { applyFlagJourneys, _gapTestHooks, _resetFlagJourneys, contentGapKey, listContentGaps, setContentGapOwnerResolver } from "@/lib/flagJourneys";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { sendForms, setChecked, signChecked, declineForm, sweepConsentForms, listSignedCopies, revokeForm, _resetConsentForms } from "@/lib/consentForms";

const coordStaff = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator")!;
const coord = { role: coordStaff.role, staffId: coordStaff.id, name: coordStaff.name };
const actor = { staffId: coordStaff.id, staffName: coordStaff.name, role: coordStaff.role };
const DAY = 86_400_000;
let n = 0;
function newPatient() {
  n += 1;
  const r = AdelanteEHR.createReferral({ firstName: "Bell", lastName: `Owner${n}${Math.random().toString(36).slice(2, 6)}`, dob: "1990-02-12", phone: `55955503${String(n).padStart(2, "0")}`, referringAgency: "Test", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "public" } as never);
  const pid = AdelanteEHR.enrollReferral(r.id)!;
  applyFlagJourneys(pid);
  return pid;
}
const byKey = (k: string) => AdelanteEHR.listNotifications().filter((x) => x.taskKey === k);
const bellSync = () => { for (let i = 0; i < 3; i++) syncBellPointers(actor); }; // hydrate, 15s tick, popover open
const unread = (k: string) => byKey(k).some((x) => !isNotificationReadBy(x, actor.staffName, actor.staffId));

beforeEach(() => _resetConsentForms());

describe("consent-unsigned", () => {
  it("survives repeated bell syncs and stays unread until signed", () => {
    const pid = newPatient();
    const sentAt = new Date(Date.now() - 4 * DAY).toISOString();
    const [r] = sendForms({ patientId: pid, formKeys: ["hipaa"], actor: coord, now: sentAt });
    sweepConsentForms();
    const key = `consent-unsigned:${r!.id}`;
    expect(byKey(key)).toHaveLength(1);
    expect(byKey(key)[0]!.pointerSource).toBe("consent");
    bellSync(); sweepConsentForms(); bellSync();
    expect(byKey(key)).toHaveLength(1);
    expect(unread(key)).toBe(true);
    setChecked(pid, "hipaa", true);
    signChecked({ patientId: pid, signerName: "Bell Owner", typedName: "Bell Owner" });
    expect(byKey(key)[0]!.closedAt).toBeTruthy();
    expect(byKey(key)[0]!.closedBy).toBe("consent");
    sweepConsentForms();
    expect(byKey(key).every((x) => x.closedAt)).toBe(true);
  });
  it("closes on decline", () => {
    const pid = newPatient();
    const [r] = sendForms({ patientId: pid, formKeys: ["portal"], actor: coord, now: new Date(Date.now() - 4 * DAY).toISOString() });
    sweepConsentForms(); bellSync();
    declineForm(pid, "portal");
    expect(byKey(`consent-unsigned:${r!.id}`)[0]!.closedAt).toBeTruthy();
  });
  it("closes on expiry", () => {
    const pid = newPatient();
    const [r] = sendForms({ patientId: pid, formKeys: ["telehealth"], actor: coord, now: new Date(Date.now() - 4 * DAY).toISOString(), dueDays: 1 });
    sweepConsentForms(); bellSync();
    sweepConsentForms(new Date(Date.now() + 30 * DAY));
    expect(byKey(`consent-unsigned:${r!.id}`)[0]!.closedAt).toBeTruthy();
  });
  it("a pointer closed by the old bug is re-raised once by the next sweep", () => {
    const pid = newPatient();
    const [r] = sendForms({ patientId: pid, formKeys: ["sms"], actor: coord, now: new Date(Date.now() - 4 * DAY).toISOString() });
    sweepConsentForms();
    const key = `consent-unsigned:${r!.id}`;
    AdelanteEHR.closeTaskPointer(key); // old-bug style close: no owner recorded
    expect(unread(key)).toBe(false);
    sweepConsentForms();
    expect(byKey(key)).toHaveLength(1);
    expect(byKey(key)[0]!.closedAt).toBeUndefined();
    expect(byKey(key)[0]!.reraisedAt).toBeTruthy();
    expect(unread(key)).toBe(true);
    AdelanteEHR.closeTaskPointer(key);
    sweepConsentForms();
    expect(byKey(key)).toHaveLength(1);
    expect(byKey(key)[0]!.closedAt).toBeTruthy(); // only once
  });
});

describe("consent-renew", () => {
  const setup = () => {
    const pid = newPatient();
    sendForms({ patientId: pid, formKeys: ["part2"], actor: coord, now: new Date(Date.now() - 340 * DAY).toISOString() });
    setChecked(pid, "part2", true);
    signChecked({ patientId: pid, signerName: "Bell Owner", typedName: "Bell Owner", at: new Date(Date.now() - 340 * DAY).toISOString() });
    const copy = listSignedCopies(pid).find((x) => x.copy.formKey === "part2")!.copy;
    sweepConsentForms();
    return { pid, key: `consent-renew:${copy.id}` };
  };
  it("survives bell syncs, stays unread, closes when resent", () => {
    const { pid, key } = setup();
    expect(byKey(key)).toHaveLength(1);
    bellSync(); sweepConsentForms(); bellSync();
    expect(unread(key)).toBe(true);
    sendForms({ patientId: pid, formKeys: ["part2"], actor: coord });
    expect(byKey(key)[0]!.closedAt).toBeTruthy();
    sweepConsentForms();
    expect(byKey(key).every((x) => x.closedAt)).toBe(true);
  });
  it("closes when revoked", () => {
    const { pid, key } = setup();
    bellSync();
    revokeForm({ patientId: pid, formKey: "part2", by: "patient" });
    expect(byKey(key)[0]!.closedAt).toBeTruthy();
  });
  it("re-raised once after an old-bug close", () => {
    const { key } = setup();
    AdelanteEHR.closeTaskPointer(key);
    sweepConsentForms();
    expect(unread(key)).toBe(true);
  });
});

describe("content-gap", () => {
  it("one key everywhere; survives syncs; in the owner's My work; closes with the gap; re-raised once", () => {
    _resetFlagJourneys();
    setContentGapOwnerResolver(() => coordStaff.id);
    _gapTestHooks.setMatcher(() => false);
    _gapTestHooks.raise("justice_involved");
    const g = listContentGaps()[0]!;
    const key = contentGapKey(g.id);
    expect(key).toBe(`content-gap:${g.id}`);
    expect(byKey(key)).toHaveLength(1);
    expect(byKey(key)[0]!.dedupeKey).toBe(key);
    expect(byKey(key)[0]!.pointerSource).toBe("content_gap");
    expect(workspaceActionRows({ actor, needsClosing: [], now: new Date() }).some((r) => r.id === key)).toBe(true);
    bellSync();
    expect(unread(key)).toBe(true);
    AdelanteEHR.closeTaskPointer(key);
    _gapTestHooks.closeIfMatched(() => false);
    expect(unread(key)).toBe(true);
    _gapTestHooks.setMatcher(() => true);
    _gapTestHooks.closeIfMatched(() => true);
    _gapTestHooks.setMatcher();
    expect(byKey(key)[0]!.closedBy).toBe("content_gap");
    expect(listContentGaps()).toHaveLength(0);
    setContentGapOwnerResolver(undefined);
  });
});

describe("workspace + case-task pointers unchanged; no prefix inference", () => {
  it("case-task pointer closes when the task is done", () => {
    const pid = newPatient();
    const cm = AdelanteEHR.listCaseManagers()[0];
    const t = AdelanteEHR.createCaseTask({ patientId: pid, title: "Call back", assignedTo: cm?.id ?? coordStaff.name, dueDate: "2026-12-01" } as never);
    const key = `task:${t.id}`;
    expect(byKey(key)[0]!.pointerSource).toBe("case_task");
    bellSync();
    expect(byKey(key)[0]!.closedAt).toBeUndefined();
    AdelanteEHR.completeCaseTask(t.id);
    expect(byKey(key)[0]!.closedAt).toBeTruthy();
  });
  it("syncBellPointers never reads key prefixes", () => {
    const src = readFileSync("src/lib/notificationRouting.ts", "utf8");
    expect(src).not.toMatch(/startsWith\(/);
    expect(src).toMatch(/pointerSource !== "workspace"/);
  });
  it("every task-kind notify names its pointerSource", () => {
    for (const f of ["src/lib/consentForms.ts", "src/lib/flagJourneys.ts", "src/lib/notificationRouting.ts", "src/lib/staffThreads.ts"])
      for (const line of readFileSync(f, "utf8").split("\n").filter((l) => /taskKey: [`k]/.test(l) && /notify|ensureTaskPointer|const note/.test(l)))
        expect(line).toMatch(/pointerSource/);
  });
});
