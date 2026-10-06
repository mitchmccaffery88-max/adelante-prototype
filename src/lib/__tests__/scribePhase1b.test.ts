import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { runAction } from "@/lib/actions/runAction";
import { AFBI_NOT_CLAIMABLE } from "@/lib/afbiGuard";
import { _resetAfbi, getAfbiContact } from "@/lib/afbiOutreach";
import {
  _addMetricRow, _resetScribe, captureBlocker, confirmAiReview, createDictationDraft, defaultSetting, deleteAiSentence, dictationBlocker,
  DICTATION_REQUIRES_PATIENT_CONSENT, editAiSentence, endScribeSession, getScribeSession, grantAiRecordingConsent, ingestScribeSegments,
  keepAiSentence, openAiDraft, pauseScribeSession, resumeScribeSession, saveAfbiFromScribe, scribePilotMetrics, setScribeOffline,
  startScribeSession, thresholdsFor, type ScribeActor, type ScribeSession,
} from "@/lib/scribe";
import { MockScribeAdapter } from "@/lib/vendors/scribe";

const COUNSELOR: ScribeActor = { name: "Renee Castillo", role: "sud_counselor", staffId: "s-sud" };
const PEER: ScribeActor = { name: "Trey Wilson", role: "peer_specialist", staffId: "s-peer" };
const DR: ScribeActor = { name: "Dr. M. Bagga", role: "physician", staffId: "s-np1", clinicianId: "c5" };
const bystander = { kind: "other" as const, agreed: true, name: "Ana R.", relationship: "Neighbour" };

function patient() {
  const p = AdelanteEHR.createPatient({ firstName: "Field", lastName: `T${Math.random().toString(36).slice(2, 6)}` } as never) as { id: string };
  return AdelanteEHR.getPatient(p.id)!;
}
function consent(pid: string) {
  grantAiRecordingConsent({ patientId: pid, signedByName: "F T", attested: true, part2: true, capturedBy: { staffName: "x", role: "therapist" } });
}
const fieldReq = (pid: string, extra: Record<string, unknown> = {}) => ({
  actor: COUNSELOR, patientId: pid, format: "dap" as const, allPartyConfirmed: true, setting: "field" as const,
  privateLocationConfirmed: true, parties: [{ kind: "patient" as const, agreed: true }, bystander], ...extra,
});

beforeEach(() => { _resetScribe(); _resetAfbi(); });

describe("Phase 1b — settings", () => {
  it("defaults: video → telehealth, in person → clinic, AFBI → field, no visit → clinic", () => {
    const p = patient();
    const mk = (modality: "video" | "in_person") => AdelanteEHR.listAppointments().find((a) => a.modality === modality)?.id;
    const v = mk("video");
    const ip = AdelanteEHR.listAppointments().find((a) => a.modality === "in_person" && !/field|home|community|street|shelter|outreach|mobile/i.test(a.locationId ?? ""))?.id;
    if (v) expect(defaultSetting({ appointmentId: v })).toBe("telehealth");
    if (ip) expect(defaultSetting({ appointmentId: ip })).toBe("clinic");
    expect(defaultSetting({ afbi: true })).toBe("field");
    expect(defaultSetting({})).toBe("clinic");
    expect(p).toBeTruthy();
  });
  it("setting is saved on the session and the draft audit; metrics by setting are suppressed under 11", () => {
    const p = patient();
    consent(p.id);
    const s = startScribeSession(fieldReq(p.id));
    expect(s.setting).toBe("field");
    endScribeSession(s.id, COUNSELOR);
    const ev = AdelanteEHR.listAuditEvents({ patientId: p.id } as never).find((e) => e.action === "scribe_draft_created") as { detail?: Record<string, unknown> };
    expect(ev?.detail?.setting).toBe("field");
    for (let i = 0; i < 10; i++) _addMetricRow({ sessionId: `m${i}`, endToSignMin: 5, editPct: 10, unsupported: 0, setting: "field" });
    expect(scribePilotMetrics({ setting: "field" }).medianEndToSignMin).toBeNull();
    _addMetricRow({ sessionId: "m10", endToSignMin: 5, editPct: 10, unsupported: 0, setting: "field" });
    expect(scribePilotMetrics({ setting: "field" }).medianEndToSignMin).toBe(5);
    expect(scribePilotMetrics({ setting: "clinic" }).medianEndToSignMin).toBeNull();
  });
});

describe("Phase 1b — field safeguards", () => {
  it("field needs the privacy confirmation", () => {
    const p = patient();
    consent(p.id);
    expect(captureBlocker(fieldReq(p.id, { privateLocationConfirmed: false }))?.reason).toMatch(/private enough/);
    expect(captureBlocker(fieldReq(p.id))).toBeNull();
  });
  it("others present must be NAMED with a relationship in field and clinic; a checkbox doesn't count", () => {
    const p = patient();
    consent(p.id);
    const unnamed = [{ kind: "patient" as const, agreed: true }, { kind: "family" as const, agreed: true }];
    expect(captureBlocker(fieldReq(p.id, { parties: unnamed }))?.reason).toMatch(/by name and relationship/);
    expect(captureBlocker(fieldReq(p.id, { setting: "clinic", parties: unnamed }))?.reason).toMatch(/by name and relationship/);
    expect(captureBlocker(fieldReq(p.id, { setting: "telehealth", parties: unnamed }))).toBeNull();
    expect(captureBlocker(fieldReq(p.id, { parties: [{ kind: "patient", agreed: true }, { ...bystander, agreed: false }] }))?.reason).toMatch(/everyone present/);
  });
  it("paused segments are never in the transcript and show as a gap", () => {
    const p = patient();
    consent(p.id);
    const s = startScribeSession(fieldReq(p.id));
    ingestScribeSegments(s.id, 2);
    pauseScribeSession(s.id, COUNSELOR);
    ingestScribeSegments(s.id, 3);
    resumeScribeSession(s.id, COUNSELOR);
    endScribeSession(s.id, COUNSELOR);
    const ids = getScribeSession(s.id)!.transcript!.map((t) => t.id);
    expect(ids).not.toContain("s3");
    expect(ids).not.toContain("s4");
    expect(ids).not.toContain("s5");
    expect(ids).toContain("s6");
    expect(s.pauses).toHaveLength(1);
    expect(s.pauses[0]!.skipped).toBe(3);
    expect(s.pauses[0]!.afterSegmentId).toBe("s2");
    // Sentences sourced only from paused speech become unsupported.
    expect(s.sentences.find((x) => x.text.includes("unable to sleep"))?.unsupported).toBe(true);
  });
  it("field thresholds are stricter (0.8 / 0.85 vs 0.7 / 0.75)", () => {
    expect(thresholdsFor("field")).toEqual({ speaker: 0.8, asr: 0.85 });
    expect(thresholdsFor("clinic")).toEqual({ speaker: 0.7, asr: 0.75 });
    const p = patient();
    consent(p.id);
    const field = startScribeSession(fieldReq(p.id));
    endScribeSession(field.id, COUNSELOR);
    const clinic = startScribeSession(fieldReq(p.id, { setting: "clinic" }));
    endScribeSession(clinic.id, COUNSELOR);
    const unsure = (s: ScribeSession) => s.sentences.filter((x) => x.unsure).length;
    expect(unsure(field)).toBeGreaterThan(unsure(clinic));
  });
});

describe("Phase 1b — offline and dictation", () => {
  it("offline disables capture and dictation; back online, dictation is offered", () => {
    const p = patient();
    consent(p.id);
    setScribeOffline(true);
    expect(captureBlocker(fieldReq(p.id))?.reason).toBe("No connection — capture can't run offline");
    expect(captureBlocker(fieldReq(p.id))?.next).toMatch(/Dictate after the encounter/);
    expect(dictationBlocker({ actor: COUNSELOR, target: "note", patientId: p.id })?.reason).toMatch(/back online/);
    setScribeOffline(false);
    expect(dictationBlocker({ actor: COUNSELOR, target: "note", patientId: p.id })).toBeNull();
  });
  it("dictation keeps patient consent required (one flag) and has full review rules", () => {
    expect(DICTATION_REQUIRES_PATIENT_CONSENT).toBe(true);
    const p = patient();
    expect(dictationBlocker({ actor: COUNSELOR, target: "note", patientId: p.id })?.reason).toMatch(/consent/);
    consent(p.id);
    const note = createDictationDraft({ actor: COUNSELOR, target: "note", patientId: p.id, format: "soap" }) as { id: string; status?: string; authorSource?: string; aiScribe?: { sessionId: string } };
    expect(note.status).toBe("draft");
    expect(note.authorSource).toBe("ai_draft");
    const s = getScribeSession(note.aiScribe!.sessionId)!;
    expect(s.kind).toBe("dictation");
    expect(s.transcript!.every((t) => t.speaker === "clinician")).toBe(true);
    expect(() => confirmAiReview(s.id, COUNSELOR, 4)).toThrow(/Open the AI draft/);
    openAiDraft(s.id, COUNSELOR);
    expect(() => confirmAiReview(s.id, COUNSELOR, 4)).toThrow(/Resolve/);
    for (const x of s.sentences.filter((y) => y.unsupported)) deleteAiSentence(s.id, x.id, COUNSELOR);
    confirmAiReview(s.id, COUNSELOR, 4);
    expect(AdelanteEHR._findNote(p.id, note.id).n?.aiScribe?.reviewConfirmedAt).toBeTruthy();
  });
  it("the adapter never returns audio and dictation is clinician voice only", () => {
    const segs = MockScribeAdapter.dictation({ target: "note", enrolled: true });
    expect(segs.every((t) => t.speaker === "clinician")).toBe(true);
    expect(JSON.stringify(segs)).not.toMatch(/audio|blob|base64/i);
  });
});

describe("Phase 1b — AFBI", () => {
  it("AFBI draft fills AFBI fields (not a progress note), saves ISL, never a claim", () => {
    const p = patient();
    consent(p.id);
    const before = (AdelanteEHR.getPatient(p.id)!.progressNotes ?? []).length;
    const s = createDictationDraft({ actor: PEER, target: "afbi", patientId: p.id }) as ScribeSession;
    expect((AdelanteEHR.getPatient(p.id)!.progressNotes ?? []).length).toBe(before);
    expect(s.afbiFields).toMatchObject({ minutes: 30, outcome: "engaged" });
    expect(() => saveAfbiFromScribe(s.id, PEER)).toThrow(/reviewed/);
    openAiDraft(s.id, PEER);
    for (const x of s.sentences.filter((y) => y.unsupported)) keepAiSentence(s.id, x.id, "I made that referral myself", PEER);
    confirmAiReview(s.id, PEER, 5);
    const c = saveAfbiFromScribe(s.id, PEER);
    expect(getAfbiContact(c.id)?.fundingLane).toBe("isl_non_medi_cal");
    expect(getScribeSession(s.id)!.transcript).toBeNull();
    expect(() => AdelanteEHRExt.upsertClaimFromPeerNote({ patientId: p.id, peerNoteId: c.id, staffId: "s", clinicianId: "c1", minutes: 30 })).toThrow(AFBI_NOT_CLAIMABLE);
    expect(AdelanteEHRExt.listClaims().some((cl) => cl.encounterId.includes(c.id))).toBe(false);
  });
  it("pre-enrollment: dictation only, initials only, identifying detail must be removed", () => {
    expect(captureBlocker({ actor: DR, patientId: "", format: "soap", allPartyConfirmed: true, target: "afbi" })?.reason).toMatch(/Pick a patient/);
    expect(dictationBlocker({ actor: PEER, target: "afbi" })?.reason).toMatch(/initials/);
    const s = createDictationDraft({ actor: PEER, target: "afbi", initials: "R.D." }) as ScribeSession;
    expect(s.patientId).toBe("");
    expect(s.afbiInitials).toBe("RD");
    const flagged = s.sentences.find((x) => x.identifying)!;
    expect(flagged.text).toMatch(/Robert Diaz/);
    openAiDraft(s.id, PEER);
    expect(() => keepAiSentence(s.id, flagged.id, "needed", PEER)).toThrow(/initials only/);
    expect(() => editAiSentence(s.id, flagged.id, "His name is Robert Diaz.", PEER)).toThrow(/identifying/);
    editAiSentence(s.id, flagged.id, "R.D. has been out about two weeks.", PEER);
    confirmAiReview(s.id, PEER, 4);
    const c = saveAfbiFromScribe(s.id, PEER);
    expect(getAfbiContact(c.id)?.initials).toBe("RD");
    expect(getAfbiContact(c.id)?.patientId).toBeUndefined();
  });
});

describe("Phase 1b — roles", () => {
  it("peer / CHW / ECM / care manager: dictation only, scoped to AFBI + own contact notes", () => {
    const p = patient();
    consent(p.id);
    for (const role of ["peer_specialist", "community_health_worker", "ecm_provider", "cf_care_manager"]) {
      const a = { name: "x", role };
      expect(runAction("scribe_start", { role: role as never }, p).ok).toBe(false);
      expect(runAction("scribe_pause", { role: role as never }, p).ok).toBe(false);
      expect(dictationBlocker({ actor: a, target: "note", patientId: p.id })?.reason).toMatch(/limited to AFBI contacts and your own contact notes/);
    }
    // cf_care_manager isn't an AFBI role; the others are.
    expect(dictationBlocker({ actor: { name: "x", role: "peer_specialist" }, target: "afbi", patientId: p.id })).toBeNull();
    expect(dictationBlocker({ actor: { name: "x", role: "cf_care_manager" }, target: "afbi", patientId: p.id })?.reason).toMatch(/field outreach/);
  });
  it("LVN has no scribe or dictation access", () => {
    const p = patient();
    expect(dictationBlocker({ actor: { name: "x", role: "lvn" }, target: "note", patientId: p.id })?.reason).toMatch(/doesn't use/);
    for (const id of ["scribe_start", "scribe_dictate", "scribe_open_draft", "scribe_review_confirm"]) expect(runAction(id, { role: "lvn" }, p).ok).toBe(false);
  });
});
