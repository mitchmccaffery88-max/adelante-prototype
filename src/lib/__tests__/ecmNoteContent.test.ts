// Draft — pending executive RBAC review: ECM provider / care manager never
// receive therapy, psychiatric or counseling note BODY text on any read path.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess, noteBodyRestricted, NOTE_CONTENT_RESTRICTED, type StaffRole } from "@/lib/roles";
import { buildNoteDocumentModel, noteExportGate } from "@/lib/notePdf";
import { buildPrintRecordDocument } from "@/lib/printRecord";
import { chartReviewFacts } from "@/lib/agenticPrototype";
import { adelBrief } from "@/lib/chartBrief";
import { ASK_ADEL_QUESTIONS, answerAskAdel } from "@/lib/askAdel";
import { noteVisibleToRole } from "@/components/agentic/NotePeekSheet";

const SECRET = "ZEBRA-THERAPY-BODY-7731";
const RESTRICTED: StaffRole[] = ["ecm_provider", "cf_care_manager"];

function setup() {
  const patient = AdelanteEHR.listPatients().find((p) => !AdelanteEHR.getConsentState(p.id).part2Sud)!;
  const note = AdelanteEHR.addProgressNote(patient.id, {
    clinicianId: "c1",
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: SECRET,
    objective: SECRET,
    assessment: SECRET,
    plan: SECRET,
    status: "signed",
    signedBy: "Anita Bagga",
    signedAt: new Date().toISOString(),
  } as never) as unknown as { id: string };
  const fresh = AdelanteEHR.getPatient(patient.id)!;
  return { patient: fresh, note: fresh.progressNotes!.find((n) => n.id === note.id)! };
}

describe("ECM / care manager — no therapy-note body on any path", () => {
  it("ECM keeps metadata (summary) — care manager stays none", () => {
    expect(canAccess("ecm_provider", "therapy_notes").level).toBe("summary");
    expect(canAccess("cf_care_manager", "therapy_notes").level).toBe("none");
  });

  for (const role of RESTRICTED) {
    it(`${role}: chart, peek, PDF, print, chart review, Adel Brief, Ask Adel, notifications`, () => {
      const { patient, note } = setup();
      // Chart / peek gate
      expect(noteVisibleToRole(role, patient, note, ["s-cm1"]).visible).toBe(false);
      // PDF export
      expect(noteExportGate(note, role, patient, ["s-cm1"]).allowed).toBe(false);
      expect(() => buildNoteDocumentModel({ note, patient, role })).toThrow();
      // Print record
      const doc = buildPrintRecordDocument({ patient, role, flags: { meds: false, mar: false, notes: true, notesScope: "all" } });
      expect(JSON.stringify(doc)).not.toContain(SECRET);
      // Agentic chart review + Adel Brief
      expect(JSON.stringify(chartReviewFacts(patient.id, role) ?? {})).not.toContain(SECRET);
      expect(JSON.stringify(adelBrief(patient, role, "s-cm1", undefined))).not.toContain(SECRET);
      // Ask Adel answers
      for (const q of ASK_ADEL_QUESTIONS) {
        const a = answerAskAdel(q.id, { role, patientId: patient.id, staffId: "s-cm1", staffName: "Luz Herrera" } as never);
        expect(JSON.stringify(a ?? {})).not.toContain(SECRET);
      }
      // Notifications
      expect(JSON.stringify(AdelanteEHR.listNotificationsFor("Luz Herrera", role, "s-cm1"))).not.toContain(SECRET);
    });
  }

  it("ECM still reads notes they authored", () => {
    const { patient, note } = setup();
    expect(noteBodyRestricted("ecm_provider", patient, note, ["c1"])).toBe(false);
    expect(noteBodyRestricted("ecm_provider", patient, note, ["s-cm1"])).toBe(true);
    expect(noteVisibleToRole("ecm_provider", patient, note, ["s-cm1"]).reason).toBe(NOTE_CONTENT_RESTRICTED);
  });

  it("therapist still reads the body", () => {
    const { patient, note } = setup();
    expect(noteExportGate(note, "therapist", patient).allowed).toBe(true);
  });
});
