import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR, type Patient, type ProgressNote } from "../ehr";
import { setActingStaff, STAFF_ROSTER } from "../roles";
import { coordinatorSudView, coordinatorSummaryLines } from "../coordinatorSudView";
import { searchPatients } from "../patientSearch";
import { noteExportGate, buildNoteDocumentModel, prepareNoteExport } from "../notePdf";
import { buildPrintRecordDocument } from "../printRecord";
import { buildNoteDraft } from "../adelDrafts";
import { chartReviewFacts } from "../agenticPrototype";
import { getAdelBrief, briefBulletsFlat } from "../adelBrief";
import { listDisclosureLog } from "../part2Disclosure";
import { saveCoordinatorEmergencyGrant, _resetCoordinatorEmergencyForTests } from "../coordinatorSudAccess";
import { noteVisibleToRole } from "@/components/agentic/NotePeekSheet";
import { captureCoordination, captureCounselingRelease, freshTestPatient } from "@/test/typedConsentCapture";
import { COORDINATOR_SUD_ITEMS } from "../coordinatorSudAccess";

const role = "clinical_coordinator" as const;
const staff = STAFF_ROSTER.find((s) => s.role === role);
if (!staff) throw new Error("Coordinator fixture missing");
const actor = { role, staffId: staff.id, name: staff.name };
const note: ProgressNote = { id: "p2-standard", clinicianId: "p2-author", date: "2026-10-19", sessionType: "individual", status: "signed", signedAt: "2026-10-19T12:00:00Z", category: "sud", subjective: "P2_STANDARD_VISIBLE", objective: "", assessment: "", plan: "" };
const counseling: ProgressNote = { ...note, id: "p2-counseling", restrictedTier: "psychotherapy_notes", subjective: "P2_COUNSELING_PRIVATE" };
function fixture(consent?: Patient["sudCoordinationConsent"], release = false): Patient {
  const p = AdelanteEHR.listPatients()[0];
  if (!p) throw new Error("Patient fixture missing");
  return { ...p, sudCoordinationConsent: consent, sudCounselingNotesRelease: release, progressNotes: [note, counseling, { ...note, id: "p2-group", category: "group", subjective: "P2_GROUP_OTHER_PATIENT" }] };
}
// B2-5 ledger (tighten): positive consent/release now come from real typed
// captures through runAction("consent_record_capture") on a fresh fictional
// patient; the flag-only fixture() is kept to assert the flag grants nothing.
function typed(consent?: Patient["sudCoordinationConsent"], release = false): Patient {
  const fresh = freshTestPatient("P2S");
  if (consent) captureCoordination(fresh.id, consent === "tpo" ? "part2_tpo_single" : "part2_specific_written", [...COORDINATOR_SUD_ITEMS]);
  if (release) captureCounselingRelease(fresh.id);
  return { ...AdelanteEHR.getPatient(fresh.id)!, progressNotes: [note, counseling, { ...note, id: "p2-group", category: "group", subjective: "P2_GROUP_OTHER_PATIENT" }] };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); _resetCoordinatorEmergencyForTests(); });

describe("Privacy P2 surface parity", () => {
  it("identifier search never returns clinical bodies, with or without consent/release", () => {
    for (const p of [fixture(), fixture("tpo"), fixture("specific_written", true)]) {
      const results = searchPatients([p], p.firstName, {}, 8, actor);
      expect(results).toHaveLength(1);
      expect(JSON.stringify(results)).not.toMatch(/P2_STANDARD|P2_COUNSELING|P2_GROUP/);
    }
  });
  it("flag alone: a flag-only fixture never shows or exports a standard or counseling note", () => {
    for (const p of [fixture("tpo"), fixture("specific_written", true), fixture(undefined, true)]) {
      expect(noteVisibleToRole(role, p, note, [actor.staffId]).visible).toBe(false);
      expect(noteExportGate(note, role, p, [actor.staffId]).allowed).toBe(false);
      expect(noteExportGate(counseling, role, p, [actor.staffId]).allowed).toBe(false);
      expect(JSON.stringify(coordinatorSummaryLines(p, actor))).not.toMatch(/P2_STANDARD|P2_COUNSELING/);
    }
  });
  it.each([undefined, "tpo", "specific_written"] as const)("note preview and export follow %s consent and separate release", (consent) => {
    const p = typed(consent);
    expect(noteVisibleToRole(role, p, note, [actor.staffId]).visible).toBe(!!consent);
    expect(noteExportGate(note, role, p, [actor.staffId]).allowed).toBe(!!consent);
    expect(noteVisibleToRole(role, p, counseling, [actor.staffId]).visible).toBe(false);
    expect(noteExportGate(counseling, role, p, [actor.staffId]).allowed).toBe(false);
    expect(() => prepareNoteExport({ note: counseling, patient: p, role, actor })).toThrow();
    expect(noteExportGate(counseling, role, typed(consent, true), [actor.staffId]).allowed).toBe(true);
  });
  it("PDF/print include consented standard notes, omit unreleased counseling, and disclose each export", () => {
    setActingStaff(actor.staffId, role);
    const p = typed("tpo");
    const count = listDisclosureLog({ patientId: p.id }).length;
    const prepared = prepareNoteExport({ note, patient: p, role, actor });
    expect(JSON.stringify(buildNoteDocumentModel(prepared))).toContain("P2_STANDARD_VISIBLE");
    const print = buildPrintRecordDocument({ patient: p, role, actor, flags: { meds: true, mar: true, notes: true, notesScope: "all" } });
    expect(JSON.stringify(print)).toContain("P2_STANDARD_VISIBLE");
    expect(JSON.stringify(print)).not.toMatch(/P2_COUNSELING|P2_GROUP/);
    expect(listDisclosureLog({ patientId: p.id }).length - count).toBe(2);
    const released = buildPrintRecordDocument({ patient: typed("tpo", true), role, actor, flags: { meds: false, mar: false, notes: true, notesScope: "all" } });
    expect(JSON.stringify(released)).toContain("P2_COUNSELING_PRIVATE");
  });
  it("summary, draft and agentic inputs omit forbidden content; release permits counseling", () => {
    setActingStaff(actor.staffId, role);
    for (const consent of [undefined, "tpo", "specific_written"] as const) {
      const p = typed(consent);
      vi.spyOn(AdelanteEHR, "getPatient").mockReturnValue(p);
      const outputs = JSON.stringify([coordinatorSummaryLines(p, actor), buildNoteDraft(p, role), chartReviewFacts(p.id, role)]);
      expect(outputs.includes("P2_STANDARD_VISIBLE")).toBe(!!consent);
      expect(outputs).not.toMatch(/P2_COUNSELING|P2_GROUP/);
      vi.restoreAllMocks();
    }
    expect(JSON.stringify(coordinatorSummaryLines(typed("tpo", true), actor))).toContain("P2_COUNSELING_PRIVATE");
  });
  it("emergency applies on every note surface and stops at exactly four hours; counseling never unlocks", () => {
    setActingStaff(actor.staffId, role);
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T03:00:00Z"));
    const p = fixture();
    saveCoordinatorEmergencyGrant({ patientId: p.id, staffId: actor.staffId, reason: "medical_emergency", detail: "Evidence", start: new Date().toISOString(), end: "2026-10-20T07:00:00Z", disclosureId: "p2-test" });
    expect(noteExportGate(note, role, p, [actor.staffId]).allowed).toBe(true);
    expect(JSON.stringify(coordinatorSummaryLines(p, actor))).toContain("P2_STANDARD_VISIBLE");
    expect(coordinatorSudView(p, actor).counselingNotes).toHaveLength(0);
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(noteExportGate(note, role, p, [actor.staffId]).allowed).toBe(false);
    expect(coordinatorSummaryLines(p, actor)).toHaveLength(0);
    expect(briefBulletsFlat(getAdelBrief(p, role))).toHaveLength(0);
  });
});