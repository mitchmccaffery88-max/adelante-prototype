import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "../ehr";
import { STAFF_ROLES, STAFF_ROSTER } from "../roles";
import { runAction } from "../actions/runAction";
import { CHECKLIST_KEYS } from "../intakePhaseA";
import { canReadIntakePacket, openIntakeFollowupChecklist, readIntakeFollowupChecklist } from "../intakeFollowup";
import { intakePacketChecklist, intakePacketDocuments, intakePacketNeeds, packetDocumentContent } from "../intakePacket";
import { intakeFormsStatus } from "../intakePhaseB";
import { roleHasChartEntry, setRecordRestricted } from "../chartAccess";

const actor = { role: "intake_coordinator" as const, staffId: "s-admin1" };
const handoff = new Date("2026-08-30T19:00:00Z");
let sequence = 0;
function fixture(classification: "general" | "part2" = "general") {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(handoff);
  const r = AdelanteEHR.createReferral({ firstName: "Window", lastName: `Fictional${++sequence}`, dob: "1990-04-12", email: `window-${sequence}@example.invalid`, referrerName: "Fixture", referralSource: "other", consentToContact: false, channel: "public" });
  AdelanteEHR.enrollReferral(r.id, { websiteSignup: true });
  const pid = r.enrolledPatientId; if (!pid) throw new Error("Missing linked fixture");
  const run = (id: string, ...args: unknown[]) => runAction(id, actor, undefined, { args: [actor, r.id, ...args, "Fictional handoff"], auditReason: "Fictional handoff" });
  expect(run("intake_packet_needs_ingest", "referral_form", `referral:${r.id}`, [{ kind: "food" }]).ok).toBe(true);
  const doc = runAction<{ documentId: string }>("intake_packet_attach", actor, undefined, { args: [actor, r.id, { type: "hra", source: "referral_form", classification, fileName: "fictional.txt", mime: "text/plain", size: 4, dataUrl: "data:text/plain;base64,dGVzdA==" }, "Fictional packet"], auditReason: "Fictional packet" });
  if (!doc.ok) throw new Error(doc.reason);
  expect(run("intake_assign_care_manager", "s-cm2", "2026-08-31").ok).toBe(true);
  expect(run("intake_assign_clinician", "s-th2", "2026-08-31").ok).toBe(true);
  expect(run("intake_complete", Object.fromEntries(CHECKLIST_KEYS.map(key => [key, true]))).ok).toBe(true);
  return { r, pid, documentId: doc.value.documentId, run };
}
afterEach(() => vi.useRealTimers());
describe("28 Oct Intake logged read-only follow-up", () => {
  it("day 60 allows packet and checklist; day 61 closes every packet projection", () => {
    const { r, documentId } = fixture();
    vi.setSystemTime(new Date("2026-10-28T19:00:00Z"));
    expect(canReadIntakePacket(actor, r.id)).toBe(true);
    expect(readIntakeFollowupChecklist(actor, r.id).completedAt).toBe(handoff.toISOString());
    expect(intakePacketNeeds(actor, r.id)).toHaveLength(1);
    expect(intakeFormsStatus(actor, r.id)).toHaveLength(5);
    expect(packetDocumentContent(actor, r.id, documentId).dataUrl).toBe("data:text/plain;base64,dGVzdA==");
    vi.setSystemTime(new Date("2026-10-29T07:00:00Z"));
    expect(canReadIntakePacket(actor, r.id)).toBe(false);
    expect(intakePacketChecklist(actor, r.id)).toEqual({ forms: [], needs: [], documents: [] });
    expect(() => openIntakeFollowupChecklist(actor, r.id)).toThrow(/window/);
    expect(() => packetDocumentContent(actor, r.id, documentId)).toThrow();
  });
  it("each explicit checklist/document open logs once without content", () => {
    const { r, pid, documentId } = fixture();
    const events = () => AdelanteEHR.listAuditEvents({ category: "access", patientId: pid }).filter(e => e.action === "record.viewed");
    const before = events().length;
    readIntakeFollowupChecklist(actor, r.id); intakePacketChecklist(actor, r.id);
    expect(events()).toHaveLength(before);
    openIntakeFollowupChecklist(actor, r.id); openIntakeFollowupChecklist(actor, r.id);
    packetDocumentContent(actor, r.id, documentId);
    expect(events()).toHaveLength(before + 3);
    expect(JSON.stringify(events().slice(0, 3))).not.toMatch(/fictional.txt|dGVzdA==/);
  });
  it("completed intake rejects edits while follow-up reads remain available", () => {
    const { r, run } = fixture();
    const need = intakePacketNeeds(actor, r.id)[0];
    expect(canReadIntakePacket(actor, r.id)).toBe(true);
    expect(run("intake_sdoh_log", need?.id, "resolved").ok).toBe(false);
    expect(run("intake_packet_needs_ingest", "referral_form", `referral:${r.id}`, [{ kind: "housing" }]).ok).toBe(false);
    expect(run("intake_form_send", "telehealth").ok).toBe(false);
    expect(intakePacketNeeds(actor, r.id)).toHaveLength(1);
    expect(roleHasChartEntry(actor.role)).toBe(false);
  });
  it("Part 2 documents remain locked without consent, and restrictions deny follow-up", () => {
    const { r, pid, documentId } = fixture("part2");
    expect(intakePacketDocuments(actor, r.id)[0]?.restricted).toBe(true);
    expect(() => packetDocumentContent(actor, r.id, documentId)).toThrow(/Part 2/);
    setRecordRestricted({ patientId: pid, restricted: true, reason: "Fictional restriction", actor: { role: "sys_admin", staffId: "s-admin1", name: "Admin" } });
    expect(canReadIntakePacket(actor, r.id)).toBe(false);
    expect(() => openIntakeFollowupChecklist(actor, r.id)).toThrow();
  });
  it.each(STAFF_ROLES.filter(role => role.key !== "intake_coordinator"))("$key cannot use the Intake follow-up read path", ({ key }) => {
    const { r } = fixture(); const staff = STAFF_ROSTER.find(s => s.role === key);
    const other = { role: key, staffId: staff?.id };
    expect(canReadIntakePacket(other, r.id)).toBe(false);
    expect(() => openIntakeFollowupChecklist(other, r.id)).toThrow();
  });
});