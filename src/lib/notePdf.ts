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
import {
  isNoteStrictlyRestricted,
  isNoteSudSensitive,
  noteStatus,
  type Patient,
  type ProgressNote,
} from "./ehr";
import { canAccess, noteGateClass, type StaffRole } from "./roles";
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
  // §ASCMI psychotherapy-notes tier — strictly more restrictive than the SUD
  // gate and checked BEFORE it: SUD consent does not unlock this tier.
  // Unreachable today (nothing sets `restrictedTier`), by design.
  if (isNoteStrictlyRestricted(note)) {
    const strict = canAccess(role, "psychotherapy_notes", patient);
    if (strict.level === "none") {
      return {
        allowed: false,
        reason: "Psychotherapy notes — not releasable under ASCMI consent.",
      };
    }
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
  // §Group sessions — group notes route through the SAME canAccess() gate.
  // noteGateClass() decides the class: only `sud_clinical_preauth` groups
  // resolve to the consent-gated `group_notes` class; skills_education and
  // open_psychoeducational resolve to no class, i.e. the ordinary note tier.
  const gateCls = noteGateClass(note);
  if (gateCls === "group_notes") {
    const grp = canAccess(role, "group_notes", patient);
    if (grp.locked) {
      return { allowed: false, reason: grp.reason ?? "Group note — consent required" };
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

export type NoteDocBlock =
  | { kind: "title"; text: string }
  | { kind: "meta"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "subheading"; text: string }
  | { kind: "field"; label: string; value: string }
  | { kind: "paragraph"; text: string };

/**
 * Content model for the export, built once and rendered by jsPDF below.
 * Keeping the content separate from the drawing calls means tests can assert
 * on exactly what the legal record says.
 *
 * Structured (template) notes render their SNAPSHOTTED schema — sections,
 * labels, answers and scoring — so the export matches what was answered,
 * independent of later template edits. Untemplated notes render classic SOAP.
 */
export function buildNoteDocumentModel(args: {
  note: ProgressNote;
  patient: Patient;
  role: StaffRole;
  authorLabel?: string;
  exportedBy?: string;
}): NoteDocBlock[] {
  const { note, patient, role, authorLabel, exportedBy } = args;
  const gate = noteExportGate(note, role, patient);
  if (!gate.allowed) throw new Error(gate.reason ?? "Export not permitted");

  const out: NoteDocBlock[] = [];
  const status = noteStatus(note);
  out.push({ kind: "title", text: "Progress Note — Signed Clinical Record" });
  out.push({ kind: "meta", text: `Note ${note.id} · status ${status}` });

  out.push({ kind: "heading", text: "Patient" });
  out.push({ kind: "field", label: "Name", value: `${patient.firstName} ${patient.lastName}` });
  out.push({ kind: "field", label: "Date of birth", value: patient.dob ?? "—" });
  out.push({ kind: "field", label: "Patient ID (MRN)", value: patient.id });

  out.push({ kind: "heading", text: "Encounter" });
  out.push({ kind: "field", label: "Date of service", value: fmt(note.date) });
  out.push({ kind: "field", label: "Session type", value: note.sessionType.replace("_", " ") });
  out.push({ kind: "field", label: "Author", value: authorLabel ?? note.clinicianId });
  out.push({
    kind: "field",
    label: "Authorship",
    value: note.authorSource === "ai_draft" ? "Machine draft, human signed" : "Human",
  });
  if (note.category)
    out.push({ kind: "field", label: "Sensitivity", value: note.category.replace("_", " ") });

  if (note.templateSchema) {
    out.push({
      kind: "heading",
      text: `Template — ${note.templateTitle ?? note.templateKey ?? "Structured note"}${
        note.templateVersion ? ` v${note.templateVersion}` : ""
      }`,
    });
    const answers = note.templateAnswers ?? {};
    for (const section of note.templateSchema.sections ?? []) {
      if (!isSectionVisible(section, answers)) continue;
      out.push({ kind: "subheading", text: section.title });
      for (const field of section.fields ?? []) {
        if (!isFieldVisible(field, answers)) continue;
        out.push({ kind: "field", label: field.label, value: answerText(answers[field.key]) });
      }
    }
    const scores = computeScore(note.templateSchema, answers);
    if (scores.length > 0) {
      out.push({ kind: "heading", text: "Scoring" });
      for (const s of scores) {
        out.push({
          kind: "field",
          label: s.label,
          value: `${s.total}${s.band ? ` — ${s.band}` : ""}${
            s.incomplete ? " (incomplete: unanswered inputs)" : ""
          }`,
        });
      }
    }
  } else {
    out.push({ kind: "heading", text: "SOAP" });
    for (const key of ["subjective", "objective", "assessment", "plan"] as const) {
      if (!note[key]) continue;
      out.push({ kind: "subheading", text: key.charAt(0).toUpperCase() + key.slice(1) });
      out.push({ kind: "paragraph", text: note[key] });
    }
  }

  out.push({ kind: "heading", text: "Attestation & provenance" });
  out.push({ kind: "field", label: "Status", value: status });
  out.push({ kind: "field", label: "Signed by", value: note.signedBy ?? "—" });
  out.push({ kind: "field", label: "Signed at", value: fmt(note.signedAt) });
  out.push({ kind: "field", label: "Cosign required", value: note.cosignRequired ? "Yes" : "No" });
  if (note.cosignedAt || note.cosignedBy) {
    out.push({ kind: "field", label: "Cosigned by", value: note.cosignedBy ?? "—" });
    out.push({ kind: "field", label: "Cosigned at", value: fmt(note.cosignedAt) });
    if (note.cosignComment)
      out.push({ kind: "field", label: "Cosign comment", value: note.cosignComment });
  }
  out.push({
    kind: "paragraph",
    text: "This document reproduces the attested clinical record as stored. Signature attestation is captured in the electronic record; the names and timestamps above are the legally binding attestation of record.",
  });
  out.push({
    kind: "meta",
    text: `Exported ${new Date().toLocaleString()}${exportedBy ? ` by ${exportedBy}` : ""} · acting role ${role}`,
  });
  return out;
}

/** Renders the content model with jsPDF (same pipeline as refusalPdf.ts). */
export function buildProgressNotePdf(args: {
  note: ProgressNote;
  patient: Patient;
  role: StaffRole;
  authorLabel?: string;
  exportedBy?: string;
}): jsPDF {
  const blocks = buildNoteDocumentModel(args);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  for (const block of blocks) {
    switch (block.kind) {
      case "title": {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        ensure(24);
        doc.text(block.text, MARGIN, y);
        y += 18;
        break;
      }
      case "meta": {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(110);
        ensure(16);
        doc.text(block.text, MARGIN, y);
        doc.setTextColor(0);
        y += 18;
        break;
      }
      case "heading": {
        ensure(30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(block.text, MARGIN, y);
        y += 14;
        doc.setDrawColor(190);
        doc.line(MARGIN, y - 6, WIDTH - MARGIN, y - 6);
        break;
      }
      case "subheading": {
        ensure(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(block.text, MARGIN, y);
        y += 14;
        break;
      }
      case "field": {
        const wrapped = doc.splitTextToSize(block.value || "—", WIDTH - MARGIN * 2 - 140);
        ensure(wrapped.length * 13 + 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(block.label, MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.text(wrapped, MARGIN + 140, y);
        y += wrapped.length * 13 + 2;
        break;
      }
      case "paragraph": {
        const wrapped = doc.splitTextToSize(block.text, WIDTH - MARGIN * 2);
        ensure(wrapped.length * 12 + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(wrapped, MARGIN, y);
        y += wrapped.length * 12 + 6;
        break;
      }
    }
  }

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
