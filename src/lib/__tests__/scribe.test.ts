import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import {
  _addMetricRow,
  _resetScribe,
  AI_CONSENT_COPY,
  aiConsentStatus,
  captureBlocker,
  confirmAiReview,
  deleteAiSentence,
  editAiSentence,
  endScribeSession,
  getScribeSession,
  grantAiRecordingConsent,
  keepAiSentence,
  openAiDraft,
  patientNeedsPart2,
  scribePilotMetrics,
  scribeView,
  startScribeSession,
  sweepScribeRetention,
  withdrawAiRecordingConsent,
  type ScribeActor,
} from "@/lib/scribe";
import { DMC_ODS_ELEMENT_KEYS, FORMAT_SECTIONS, SCRIBE_FORMATS, templateKeyFor } from "@/lib/scribeFormats";
import { findMissingRequired } from "@/lib/templateSchema";

const DR: ScribeActor = { name: "Dr. M. Bagga", role: "physician", staffId: "s-np1", clinicianId: "c5" };
const staff = { staffId: "s-np1", staffName: "Dr. M. Bagga", role: "physician" };

function newPatient(sud = false) {
  const p = AdelanteEHR.addPatient({ firstName: "Scribe", lastName: `Test${Math.random().toString(36).slice(2, 6)}`, dob: "1990-01-01", phone: "5595550100" } as never) as { id: string };
  const pt = AdelanteEHR.getPatient(p.id)!;
  if (sud) pt.problems = [...(pt.problems ?? []), { id: "pr-sud", code: "F11.20", description: "x", category: "sud", status: "active" } as never];
  return pt;
}
function grant(pid: string, part2 = false, extra: Partial<Parameters<typeof grantAiRecordingConsent>[0]> = {}) {
  return grantAiRecordingConsent({ patientId: pid, signedByName: "Pat Ient", attested: true, part2, capturedBy: staff, ...extra });
}
const start = (pid: string) => startScribeSession({ actor: DR, patientId: pid, format: "soap", allPartyConfirmed: true });
const auditsWith = (pid: string) => AdelanteEHR.listAuditEvents({ patientId: pid } as never);

beforeEach(() => _resetScribe());

describe("Scribe S1 — consent gate", () => {
  it("missing consent blocks", () => {
    const p = newPatient();
    expect(captureBlocker({ actor: DR, patientId: p.id, format: "soap", allPartyConfirmed: true })?.reason).toMatch(/No AI recording consent/);
  });
  it("revoked (withdrawn) consent blocks", () => {
    const p = newPatient();
    grant(p.id);
    withdrawAiRecordingConsent({ patientId: p.id, by: "Pat", role: "patient" });
    expect(aiConsentStatus(p.id).state).toBe("withdrawn");
    expect(captureBlocker({ actor: DR, patientId: p.id, format: "soap", allPartyConfirmed: true })?.reason).toMatch(/withdrew/);
  });
  it("expired consent blocks", () => {
    const p = newPatient();
    grant(p.id, false, { effectiveOn: "2020-01-01", expiresOn: "2020-06-01" });
    expect(captureBlocker({ actor: DR, patientId: p.id, format: "soap", allPartyConfirmed: true })?.reason).toMatch(/expired/);
  });
  it("all-party confirmation is required per session", () => {
    const p = newPatient();
    grant(p.id);
    expect(captureBlocker({ actor: DR, patientId: p.id, format: "soap", allPartyConfirmed: false })?.reason).toMatch(/everyone present/);
    expect(captureBlocker({ actor: DR, patientId: p.id, format: "soap", allPartyConfirmed: true, parties: [{ kind: "patient", agreed: true }, { kind: "interpreter", agreed: false }] })).not.toBeNull();
    expect(captureBlocker({ actor: DR, patientId: p.id, format: "soap", allPartyConfirmed: true })).toBeNull();
  });
  it("withdrawal mid-session stops capture and discards the transcript (audited)", () => {
    const p = newPatient();
    grant(p.id);
    const s = start(p.id);
    expect(s.transcript?.length).toBeGreaterThan(0);
    withdrawAiRecordingConsent({ patientId: p.id, by: "Pat", role: "patient" });
    const after = getScribeSession(s.id)!;
    expect(after.state).toBe("discarded");
    expect(after.transcript).toBeNull();
    expect(auditsWith(p.id).some((e) => e.action === "scribe_capture_discarded")).toBe(true);
    expect(() => endScribeSession(s.id, DR)).toThrow();
  });
  it("a group session with any present member lacking consent blocks, initials only", () => {
    const a = newPatient();
    const b = newPatient();
    grant(a.id, true);
    const r = captureBlocker({ actor: DR, patientId: a.id, format: "girp", allPartyConfirmed: true, groupSessionId: "g-x", presentPatientIds: [a.id, b.id] });
    expect(r?.reason).toMatch(/Group capture is blocked/);
    expect(r?.reason).toContain("S.T.");
    expect(r?.reason).not.toContain(b.lastName);
  });
  it("roles outside Phase 1 can't capture", () => {
    const p = newPatient();
    grant(p.id);
    expect(captureBlocker({ actor: { name: "x", role: "lvn" }, patientId: p.id, format: "soap", allPartyConfirmed: true })?.reason).toMatch(/Phase|phase/);
  });
});

describe("Scribe S1 — Part 2 line", () => {
  it("is required for SUD patients", () => {
    const p = newPatient(true);
    expect(patientNeedsPart2(p)).toBe(true);
    expect(() => grant(p.id, false)).toThrow(/Part 2/);
    grant(p.id, true);
    expect(aiConsentStatus(p.id).part2).toBe(true);
    const rec = AdelanteEHR.activeConsentRecord(p.id)!;
    expect(rec.sections.find((s) => s.category === "ai_session_recording_part2")?.authorized).toBe(true);
    expect(AI_CONSENT_COPY.en.part2Line).toMatch(/Part 2/);
    expect(AI_CONSENT_COPY.es.draft).toMatch(/Borrador/);
  });
  it("granting carries other consent sections forward", () => {
    const p = newPatient();
    AdelanteEHR.createConsentRecord({ patientId: p.id, formType: "NonAB133", source: "t", signedByName: "Pat", attested: true, effectiveDate: "2026-01-01", sections: [{ category: "telehealth_services", authorized: true }], capturedBy: { staffName: "x", role: "therapist" } });
    grant(p.id);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "telehealth_services")).toBe(true);
  });
  it("patients grant through runAction (standard audit event)", () => {
    const p = newPatient();
    const r = runAction("scribe_consent_grant", { role: PATIENT_ACTOR_ROLE, staffId: p.id, staffName: "Patient (self)" }, p, { args: [{ patientId: p.id, signedByName: "Pat Ient", attested: true, part2: false, capturedBy: { staffName: "Patient (self)", role: "patient" } }] });
    expect(r.ok).toBe(true);
    expect(aiConsentStatus(p.id).state).toBe("active");
  });
});

describe("Scribe S2/S3 — draft, review, sign gate", () => {
  function drafted(sud = false) {
    const p = newPatient(sud);
    grant(p.id, sud);
    const s = start(p.id);
    const note = endScribeSession(s.id, DR);
    return { p, s: getScribeSession(s.id)!, note };
  }
  const sign = (pid: string, nid: string) => AdelanteEHR.signProgressNote(pid, nid, { signedBy: DR.name, role: "physician", attested: true });

  it("lands in the chart as an unsigned AI draft", () => {
    const { p, note, s } = drafted();
    const n = AdelanteEHR.getPatient(p.id)!.progressNotes!.find((x) => x.id === note.id)!;
    expect(n.status).toBe("draft");
    expect(n.authorSource).toBe("ai_draft");
    expect(n.templateTitle).toMatch(/AI draft — review required/);
    expect(n.aiScribe?.includedSpanish).toBe(true);
    expect(s.sentences.some((x) => x.unsupported)).toBe(true);
    expect(s.sentences.some((x) => x.speakerUncertain)).toBe(true);
    expect(s.sentences.every((x) => x.unsupported || x.sources.length > 0)).toBe(true);
  });
  it("signing is blocked until opened, every unsupported sentence resolved and review confirmed", () => {
    const { p, note, s } = drafted();
    expect(() => sign(p.id, note.id)).toThrow(/Open the AI draft/);
    openAiDraft(s.id, DR);
    expect(() => sign(p.id, note.id)).toThrow(/Not found in transcript/);
    expect(() => confirmAiReview(s.id, DR, 4)).toThrow();
    const bad = s.sentences.find((x) => x.unsupported)!;
    expect(() => keepAiSentence(s.id, bad.id, "", DR)).toThrow();
    deleteAiSentence(s.id, bad.id, DR);
    expect(() => sign(p.id, note.id)).toThrow(/I reviewed and edited/);
    editAiSentence(s.id, s.sentences[0]!.id, "Patient reports working every day this week.", DR);
    confirmAiReview(s.id, DR, 4);
    sign(p.id, note.id);
    const n = AdelanteEHR.getPatient(p.id)!.progressNotes!.find((x) => x.id === note.id)!;
    expect(n.status).toBe("signed");
    // AI version kept as a revision.
    expect(n.priorVersions?.some((v) => v.version === 0)).toBe(true);
    expect(n.templateAnswers?.["soap_assessment"]).not.toMatch(/self-harm/);
  });
  it("an edit after confirming clears the confirmation", () => {
    const { s } = drafted();
    openAiDraft(s.id, DR);
    keepAiSentence(s.id, s.sentences.find((x) => x.unsupported)!.id, "Asked directly in session", DR);
    confirmAiReview(s.id, DR, 5);
    editAiSentence(s.id, s.sentences[0]!.id, "Edited.", DR);
    const { n } = AdelanteEHR._findNote(s.patientId, s.noteId!);
    expect(n?.aiScribe?.reviewConfirmedAt).toBeUndefined();
  });
  it("creates no codes, orders, tasks or care-plan changes", () => {
    const p = newPatient();
    grant(p.id);
    const before = { o: AdelanteEHR.listOrders(p.id).length, t: (p.tasks ?? []).length, g: (p.goals ?? []).length, pr: (p.problems ?? []).length };
    const s = start(p.id);
    const note = endScribeSession(s.id, DR);
    const pt = AdelanteEHR.getPatient(p.id)!;
    expect({ o: AdelanteEHR.listOrders(p.id).length, t: (pt.tasks ?? []).length, g: (pt.goals ?? []).length, pr: (pt.problems ?? []).length }).toEqual(before);
    const txt = JSON.stringify(note.templateAnswers);
    expect(txt).not.toMatch(/\b[A-Z]\d{2}\.\d|\b9\d{4}\b|H\d{4}/);
  });
});

describe("Scribe — formats", () => {
  it("every format's template includes the DMC-ODS elements", () => {
    for (const f of SCRIBE_FORMATS) {
      const t = AdelanteEHR.listNoteTemplates().find((x) => x.key === templateKeyFor(f))!;
      expect(t).toBeTruthy();
      const keys = findMissingRequired(t.schema, {}).map((m) => m.key);
      for (const k of DMC_ODS_ELEMENT_KEYS) expect(keys).toContain(k);
      for (const sec of FORMAT_SECTIONS[f]) expect(keys).toContain(sec.key);
    }
  });
});

describe("Scribe — retention", () => {
  it("deletes the transcript at signing and leaves an audited stub; provenance survives", () => {
    const p = newPatient();
    grant(p.id);
    const s = start(p.id);
    const note = endScribeSession(s.id, DR);
    openAiDraft(s.id, DR);
    deleteAiSentence(s.id, getScribeSession(s.id)!.sentences.find((x) => x.unsupported)!.id, DR);
    confirmAiReview(s.id, DR, 3);
    AdelanteEHR.signProgressNote(p.id, note.id, { signedBy: DR.name, role: "physician", attested: true });
    expect(sweepScribeRetention()).toBe(1);
    const after = getScribeSession(s.id)!;
    expect(after.transcript).toBeNull();
    expect(after.transcriptDeleted?.reason).toBe("signed");
    expect(after.sentences.some((x) => x.sources.length > 0)).toBe(true);
    expect(auditsWith(p.id).some((e) => e.action === "scribe_transcript_deleted")).toBe(true);
  });
  it("deletes an unsigned transcript after 7 days", () => {
    const p = newPatient();
    grant(p.id);
    const s = start(p.id);
    endScribeSession(s.id, DR);
    expect(sweepScribeRetention(new Date(Date.now() + 6 * 86400000))).toBe(0);
    expect(sweepScribeRetention(new Date(Date.now() + 8 * 86400000))).toBe(1);
    expect(getScribeSession(s.id)!.transcriptDeleted?.reason).toBe("unsigned_7_days");
  });
});

describe("Scribe — Part 2 masking and audit text", () => {
  it("masks SUD transcripts for roles without SUD access; audit carries no content", () => {
    const p = newPatient(true);
    grant(p.id, true);
    const s = start(p.id);
    endScribeSession(s.id, DR);
    expect(scribeView(s.id, "billing").masked).toBe(true);
    expect(scribeView(s.id, "physician").masked).toBe(false);
    const rows = JSON.stringify(auditsWith(p.id).filter((e) => String(e.action).startsWith("scribe_")));
    for (const seg of getScribeSession(s.id)!.sentences) expect(rows).not.toContain(seg.text);
    expect(rows).not.toMatch(/ansioso|breathing|grounding/i);
  });
});

describe("Scribe — pilot metrics", () => {
  it("are suppressed under 11", () => {
    for (let i = 0; i < 10; i++) _addMetricRow({ sessionId: `m${i}`, endToSignMin: 10, editPct: 20, unsupported: 1, rating: 4 });
    expect(scribePilotMetrics().meanEditPct).toBeNull();
    _addMetricRow({ sessionId: "m10", endToSignMin: 12, editPct: 20, unsupported: 1, rating: 4 });
    const m = scribePilotMetrics();
    expect(m.belowMinimumCohort).toBe(false);
    expect(m.meanEditPct).toBe(20);
    expect(m.meanRating).toBe(4);
  });
});
