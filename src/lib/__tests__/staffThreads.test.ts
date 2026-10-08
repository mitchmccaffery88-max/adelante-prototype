import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { listEscalations, _resetEscalationOverlays } from "@/lib/escalations";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { STAFF_ROSTER } from "@/lib/roles";
import {
  _resetStaffThreads,
  chartRefView,
  listThreadsFor,
  openMentionsFor,
  participantBlockReason,
  SCOPE_BLOCK_REASON,
  SUD_BLOCK_REASON,
  THREAD_NOTIFY_BODY,
  THREAD_NOTIFY_SUBJECT,
  MENTION_NOTIFY_SUBJECT,
  threadsForEscalation,
  type StaffThread,
} from "@/lib/staffThreads";

const COORD = { role: "clinical_coordinator" as const, staffId: "s-cc1", name: "Priya Raman" };
const ANITA = STAFF_ROSTER.find((m) => m.id === "s-th3")!;
const anita = { role: ANITA.role, staffId: ANITA.id, name: ANITA.name };
const anitaPatient = () => AdelanteEHR.listPatients().find((p) => p.prescriberStaffId === "s-th3" || p.primaryClinicianId === "c3")!;
const luis = () => AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
const run = <T,>(id: string, actor: typeof COORD | typeof anita, patientId: string | undefined, ...args: unknown[]) => {
  const r = runAction<T>(id, actor, patientId ? AdelanteEHR.getPatient(patientId) : undefined, { args });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};

describe("U2 staff-to-staff messaging", () => {
  beforeEach(() => { _resetStaffThreads(); _resetEscalationOverlays(); });

  it("participant scope: only staff who can access the patient", () => {
    const p = luis();
    const out = STAFF_ROSTER.find((m) => m.role === "peer_specialist" && m.active !== false && p.caseManagerId !== m.caseManagerId)!;
    const t = { kind: "care_team" as const, patientId: p.id, containsSud: false };
    const reason = participantBlockReason(t, out.id);
    // Peers outside the patient's assignments are refused with a plain reason.
    if (reason) expect(reason).toBe(SCOPE_BLOCK_REASON);
    expect(participantBlockReason(t, "s-bill1")).toMatch(/doesn't use team messaging/);
    expect(participantBlockReason(t, COORD.staffId)).toBeNull();
    expect(() => run("message_team", COORD, p.id, { kind: "care_team", patientId: p.id, participantIds: ["s-bill1"] }, COORD)).toThrow();
  });

  it("SUD thread blocks participants without SUD access", () => {
    const p = anitaPatient();
    const noSud = STAFF_ROSTER.find((m) => m.active !== false && ["clinical_coordinator", "sys_admin"].includes(m.role) && !roleSeesAsamSection(m.role, p))!;
    expect(participantBlockReason({ kind: "care_team", patientId: p.id, containsSud: true }, noSud.id)).toBe(SUD_BLOCK_REASON);
    const t = run<StaffThread>("message_team", anita, p.id, { kind: "care_team", patientId: p.id, participantIds: [], fromSudContent: true }, anita);
    expect(t.containsSud).toBe(roleSeesAsamSection(anita.role, p));
    if (t.containsSud) expect(() => run("staff_thread_add_participant", anita, p.id, t.id, noSud.id, anita)).toThrow(SUD_BLOCK_REASON);
    // A participant without SUD access blocks flagging later.
    const t2 = run<StaffThread>("message_team", anita, p.id, { kind: "care_team", patientId: p.id, participantIds: [noSud.id] }, anita);
    expect(() => run("staff_thread_flag_sud", anita, p.id, t2.id, anita)).toThrow(/Remove/);
    // Neutral chart reference.
    expect(chartRefView({ sectionId: "asam", label: "ASAM Oct 2", sud: true }, { role: noSud.role }, p).text).toBe("Chart item — restricted for your role");
  });

  it("@mention → Reply needed in Needs my action → cleared on reply; neutral notification, no preview", () => {
    const p = anitaPatient();
    const t = run<StaffThread>("message_team", COORD, p.id, { kind: "care_team", patientId: p.id, participantIds: [anita.staffId] }, COORD);
    run("staff_thread_post", COORD, p.id, t.id, { body: "@Anita can you call him back about the new dose?" }, COORD);
    expect(openMentionsFor(anita.staffId)).toHaveLength(1);
    const rows = () => workspaceActionRows({ actor: { staffId: ANITA.id, staffName: ANITA.name, clinicianId: ANITA.clinicianId, role: ANITA.role } as never, needsClosing: [] });
    expect(rows().some((r) => r.kind === "reply")).toBe(true);
    const n = AdelanteEHR.listNotificationsFor(ANITA.name, ANITA.role, ANITA.id).find((x) => x.subject === MENTION_NOTIFY_SUBJECT)!;
    expect(n.body).toBe(THREAD_NOTIFY_BODY);
    expect(JSON.stringify(n)).not.toMatch(/dose|call him/);
    expect(n.audience ?? "staff").toBe("staff");
    run("staff_thread_post", anita, p.id, t.id, { body: "Done, called." }, anita);
    expect(openMentionsFor(anita.staffId)).toHaveLength(0);
    expect(rows().some((r) => r.kind === "reply")).toBe(false);
    // Mark done path + read receipts + resolve/reopen.
    run("staff_thread_post", anita, p.id, t.id, { body: "@Priya fyi" }, anita);
    const m = openMentionsFor(COORD.staffId)[0];
    run("staff_thread_mention_done", COORD, p.id, m.id, COORD);
    expect(openMentionsFor(COORD.staffId)).toHaveLength(0);
    run("staff_thread_read", COORD, p.id, t.id, COORD);
    expect(listThreadsFor(COORD)[0].participants.find((x) => x.staffId === COORD.staffId)!.lastReadAt).toBeTruthy();
    run("staff_thread_resolve", COORD, p.id, t.id, COORD);
    expect(() => run("staff_thread_post", COORD, p.id, t.id, { body: "x" }, COORD)).toThrow(/Reopen/);
    run("staff_thread_reopen", COORD, p.id, t.id, COORD);
  });

  it("patients and advocates never see staff threads; audits carry no content", () => {
    const p = anitaPatient();
    const t = run<StaffThread>("message_team", COORD, p.id, { kind: "care_team", patientId: p.id, participantIds: [anita.staffId] }, COORD);
    run("staff_thread_post", COORD, p.id, t.id, { body: "Secret clinical detail XYZZY" }, COORD);
    // Patient/advocate feeds never carry it.
    const all = JSON.stringify(AdelanteEHR.listNotificationsFor("", undefined, undefined));
    expect(all).not.toMatch(/XYZZY/);
    expect(JSON.stringify(AdelanteEHR.getPatient(p.id))).not.toMatch(/XYZZY/);
    expect(listThreadsFor({ role: "billing", staffId: "s-bill1" })).toEqual([]);
    const audits = AdelanteEHR.listAuditEvents({}).filter((e) => String(e.action).startsWith("staff_thread"));
    expect(audits.length).toBeGreaterThan(0);
    expect(JSON.stringify(audits)).not.toMatch(/XYZZY/);
    const std = AdelanteEHR.listAuditEvents({}).filter((e) => e.action === "action.succeeded");
    expect(JSON.stringify(std)).not.toMatch(/XYZZY/);
  });

  it("a thread started from an escalation stays linked to it", () => {
    const p = luis();
    const e = AdelanteEHR.flagCrisis(p.id, "Priya Raman", "Unsafe statement");
    const key = `crisis:${e.id}`;
    run("escalation_handoff", COORD, p.id, key, { toStaffId: anita.staffId, reason: "Prescriber follow-up" }, COORD);
    expect(listEscalations(COORD).find((r) => r.key === key)!.ownerStaffId).toBe(anita.staffId);
    const t = run<StaffThread>("message_team", COORD, p.id, { kind: "care_team", patientId: p.id, participantIds: [anita.staffId], escalationKey: key }, COORD);
    expect(t.escalationKey).toBe(key);
    expect(threadsForEscalation(key, anita).map((x) => x.id)).toEqual([t.id]);
    expect(() => run("message_team", COORD, p.id, { kind: "care_team", patientId: p.id, participantIds: [], escalationKey: "crisis:nope" }, COORD)).toThrow(/not found/);
  });
});
