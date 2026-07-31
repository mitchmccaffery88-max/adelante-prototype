// §Clinical documentation Phase 3a follow-up — one-click PDF export of a
// FINALIZED progress note as a legal record.
//
// Pipeline: jsPDF, client-side, the SAME dependency and drawing idiom already
// used by src/lib/refusalPdf.ts. No second pipeline is introduced.
//
// Gating rule: `noteExportGate` is the ONLY entry point. It re-uses
// `canAccess` (therapy_notes + screeners_sud) and `isNoteSudSensitive` — the
// exact functions the Notes tab uses on-screen — so an export can never show
// content a role could not read in the UI. `buildProgressNotePdf` re-runs the
// gate itself and throws, so a caller cannot bypass it by skipping the check.
import { jsPDF } from "jspdf";
import { isNoteSudSensitive, noteStatus, type Patient, type ProgressNote } from "./ehr";
import { canAccess, type StaffRole } from "./roles";
import { computeScore, isAnswered, isFieldVisible, isSectionVisible } from "./templateSchema";
import type { AnswerValue } from "./templateSchema";

const MARGIN = 48;
const WIDTH = 595; // A4 portrait points
const HEIGHT = 842;

/** Only legally attested notes are exportable as an "official" document. */
export const EXPORTABLE_NOTE_STATUSES = ["signed", "cosigned"] as const;

export interface NoteExportGate {
  allowed: boolean;
  /** Why the action is unavailable. Undefined when allowed. */
  reason?: string;
}

/**
 * Single source of truth for "may this role export this note?".
 *  1. finalized only (signed / cosigned),
 *  2. RBAC: at least read on `therapy_notes` for this patient,
 *  3. SUD masking: a note the role would see masked on-screen is not
 *     exportable at all — we never render the underlying content.
 */
export function noteExportGate(
  note: ProgressNote,
  role: StaffRole,
  patient?: Patient,
): NoteExportGate {
  const status = noteStatus(note);
  if (!(EXPORTABLE_NOTE_STATUSES as readonly string[]).includes(status)) {
    return { allowed: false, reason: "Only signed or cosigned notes can be exported." };
  }
  const rbac = canAccess(role, "therapy_notes", patient);
  if (rbac.level === "none") {
    return { allowed: false, reason: rbac.reason ?? "No access to clinical notes." };
  }
  if (isNoteSudSensitive(note)) {
    const sud = canAccess(role, "screeners_sud", patient);
    if (sud.locked) {
      return {
        allowed: false,
        reason: sud.reason ?? "SUD note — 42 CFR Part 2 consent required",
      };
    }
  }
  return { allowed: true };
}

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function answerText(v: AnswerValue): string {
  if (!isAnswered(v)) return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/**
 * Renders a finalized progress note. Structured (template) notes render their
 * snapshotted schema — sections, labels, answers and scoring — so the export
 * matches exactly what was answered, independent of later template edits.
 * Untemplated notes render the classic SOAP structure.
 */
export function buildProgressNotePdf(args: {
  note: ProgressNote;
  patient: Patient;
  role: StaffRole;
  authorLabel?: string;
  exportedBy?: string;
}): jsPDF {
  const { note, patient, role, authorLabel, exportedBy } = args;
  const gate = noteExportGate(note, role, patient);
  if (!gate.allowed) throw new Error(gate.reason ?? "Export not permitted");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const heading = (text: string) => {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, MARGIN, y);
    y += 14;
    doc.setDrawColor(190);
    doc.line(MARGIN, y - 6, WIDTH - MARGIN, y - 6);
  };
  const line = (label: string, value: string) => {
    const wrapped = doc.splitTextToSize(value || "—", WIDTH - MARGIN * 2 - 140);
    ensure(wrapped.length * 13 + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(wrapped, MARGIN + 140, y);
    y += wrapped.length * 13 + 2;
  };
  const paragraph = (text: string) => {
    const wrapped = doc.splitTextToSize(text, WIDTH - MARGIN * 2);
    ensure(wrapped.length * 12 + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 12 + 6;
  };

  const status = noteStatus(note);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Progress Note — Signed Clinical Record", MARGIN, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Note ${note.id} · status ${status}`, MARGIN, y);
  doc.setTextColor(0);
  y += 20;

  heading("Patient");
  line("Name", `${patient.firstName} ${patient.lastName}`);
  line("Date of birth", patient.dob ?? "—");
  line("Patient ID (MRN)", patient.id);

  heading("Encounter");
  line("Date of service", fmt(note.date));
  line("Session type", note.sessionType.replace("_", " "));
  line("Author", authorLabel ?? note.clinicianId);
  line("Authorship", note.authorSource === "ai_draft" ? "Machine draft, human signed" : "Human");
  if (note.category) line("Sensitivity", note.category.replace("_", " "));

  if (note.templateSchema) {
    heading(
      `Template — ${note.templateTitle ?? note.templateKey ?? "Structured note"}${
        note.templateVersion ? ` v${note.templateVersion}` : ""
      }`,
    );
    const answers = note.templateAnswers ?? {};
    for (const section of note.templateSchema.sections ?? []) {
      if (!isSectionVisible(section, answers)) continue;
      ensure(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(section.title, MARGIN, y);
      y += 14;
      for (const field of section.fields ?? []) {
        if (!isFieldVisible(field, answers)) continue;
        line(field.label, answerText(answers[field.key]));
      }
      y += 4;
    }
    const scores = computeScore(note.templateSchema, answers);
    if (scores.length > 0) {
      heading("Scoring");
      for (const s of scores) {
        line(
          s.label,
          `${s.total}${s.band ? ` — ${s.band}` : ""}${
            s.incomplete ? " (incomplete: unanswered inputs)" : ""
          }`,
        );
      }
    }
  } else {
    heading("SOAP");
    for (const key of ["subjective", "objective", "assessment", "plan"] as const) {
      if (!note[key]) continue;
      ensure(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(key.charAt(0).toUpperCase() + key.slice(1), MARGIN, y);
      y += 13;
      paragraph(note[key]);
    }
  }

  heading("Attestation & provenance");
  line("Status", status);
  line("Signed by", note.signedBy ?? "—");
  line("Signed at", fmt(note.signedAt));
  line("Cosign required", note.cosignRequired ? "Yes" : "No");
  if (note.cosignedAt || note.cosignedBy) {
    line("Cosigned by", note.cosignedBy ?? "—");
    line("Cosigned at", fmt(note.cosignedAt));
    if (note.cosignComment) line("Cosign comment", note.cosignComment);
  }
  paragraph(
    "This document reproduces the attested clinical record as stored. Signature attestation is captured in the electronic record; the names and timestamps above are the legally binding attestation of record.",
  );

  ensure(24);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Exported ${new Date().toLocaleString()}${exportedBy ? ` by ${exportedBy}` : ""} · acting role ${role}`,
    MARGIN,
    HEIGHT - MARGIN + 16,
  );
  doc.setTextColor(0);

  return doc;
}

export function notePdfFilename(note: ProgressNote, patient: Patient): string {
  const date = (note.signedAt ?? note.date ?? "").slice(0, 10) || "undated";
  return `note-${patient.lastName.toLowerCase()}-${date}-${note.id.slice(0, 6)}.pdf`;
}

/** One-click export: builds and downloads the PDF in the browser. */
export function downloadProgressNotePdf(
  args: Parameters<typeof buildProgressNotePdf>[0],
): string {
  const doc = buildProgressNotePdf(args);
  const filename = notePdfFilename(args.note, args.patient);
  doc.save(filename);
  return filename;
}
