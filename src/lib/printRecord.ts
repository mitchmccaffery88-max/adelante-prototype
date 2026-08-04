// §Print/export center — combined patient-record document model.
//
// This is DELIBERATELY a second mechanism from the single-note jsPDF export
// (src/lib/notePdf.ts): that one produces one attested note as a legal
// document; this one assembles a multi-section chart packet rendered by the
// BROWSER's print pipeline. They are not unified.
//
// What IS shared — on purpose, so this export can never become a side channel
// around consent gating — is the note gate itself: every note goes through
// `noteExportGate` + `buildNoteDocumentModel`, the exact functions the Notes
// tab and the single-note PDF use. A note masked on-screen for a role is
// masked here, with no content in the model at all.
//
// Sections are limited to what Adelante actually stores: medications (Orders),
// MAR (DoseAdministration), and signed notes. No labs / diet / restrictions —
// there is no infrastructure behind them, so no empty stubs.
import {
  AdelanteEHR,
  isNoteSudSensitive,
  noteStatus,
  type DoseAdministration,
  type MedOrder,
  type Patient,
  type ProgressNote,
} from "./ehr";
import { facilityDateKey } from "./facilityTime";
import { buildNoteDocumentModel, noteExportGate, type NoteDocBlock } from "./notePdf";
import { canAccess, type StaffRole } from "./roles";

export type NotesScope = "current" | "range" | "all";

export interface PrintFlags {
  meds: boolean;
  mar: boolean;
  notes: boolean;
  notesScope: NotesScope;
  notesFrom?: string;
  notesTo?: string;
  /** YYYY-MM, facility-local. */
  marMonth?: string;
}

export const PRINT_SECTION_KEYS = ["meds", "mar", "notes"] as const;
export type PrintSectionKey = (typeof PRINT_SECTION_KEYS)[number];

export const PRINT_SECTION_LABEL: Record<PrintSectionKey, string> = {
  meds: "Medications",
  mar: "Medication administration record",
  notes: "Progress notes",
};

/** RBAC: which record class each printable section reads. */
export const PRINT_SECTION_CLASS = {
  meds: "meds_erx",
  mar: "meds_erx",
  notes: "therapy_notes",
} as const;

export function monthKey(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 7);
  return facilityDateKey(d, tz).slice(0, 7);
}

export interface PrintNoteEntry {
  note: ProgressNote;
  /** Rendered content, or undefined when the note is masked for this role. */
  blocks?: NoteDocBlock[];
  masked: boolean;
  maskReason?: string;
  authorLabel: string;
}

export interface PrintMarRow {
  administration: DoseAdministration;
  order?: MedOrder;
}

export type PrintSection =
  | { key: "meds"; label: string; orders: MedOrder[] }
  | { key: "mar"; label: string; month: string; rows: PrintMarRow[] }
  | { key: "notes"; label: string; scopeLabel: string; entries: PrintNoteEntry[] };

export interface PrintDenial {
  key: PrintSectionKey;
  label: string;
  reason: string;
}

export interface PrintRecordDocument {
  patient: Patient;
  facilityName: string;
  role: StaffRole;
  printedAt: string;
  sections: PrintSection[];
  denied: PrintDenial[];
}

/** Start of the "current" notes window — the active booking episode. */
function currentEpisodeStart(patient: Patient): string {
  const booking = AdelanteEHR.listBookings(patient.id)[0];
  return booking?.bookedAt ?? patient.enrolledAt;
}

function inRange(iso: string, from?: string, to?: string): boolean {
  const day = (iso ?? "").slice(0, 10);
  if (from && day < from.slice(0, 10)) return false;
  if (to && day > to.slice(0, 10)) return false;
  return true;
}

function authorLabelFor(note: ProgressNote): string {
  return (
    AdelanteEHR.listClinicians().find((c) => c.id === note.clinicianId)?.name ?? note.clinicianId
  );
}

/**
 * Builds the printable document for a role. Sections the role cannot read are
 * NOT rendered — they land in `denied` with the RBAC reason, so requesting
 * `?meds=1` without meds access yields nothing.
 */
export function buildPrintRecordDocument(args: {
  patient: Patient;
  role: StaffRole;
  flags: PrintFlags;
  now?: Date;
}): PrintRecordDocument {
  const { patient, role, flags } = args;
  const now = args.now ?? new Date();
  const tz = patient.facilityTimezone;
  const sections: PrintSection[] = [];
  const denied: PrintDenial[] = [];

  const gate = (key: PrintSectionKey): boolean => {
    const access = canAccess(role, PRINT_SECTION_CLASS[key], patient);
    if (access.level === "none") {
      denied.push({
        key,
        label: PRINT_SECTION_LABEL[key],
        reason: access.reason ?? "No access to this section for the acting role.",
      });
      return false;
    }
    return true;
  };

  if (flags.meds && gate("meds")) {
    const orders = AdelanteEHR.listOrders(patient.id)
      .filter((o) => o.status !== "draft")
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
    sections.push({ key: "meds", label: PRINT_SECTION_LABEL.meds, orders });
  }

  if (flags.mar && gate("mar")) {
    const month = flags.marMonth ?? facilityDateKey(now, tz).slice(0, 7);
    const orders = AdelanteEHR.listOrders(patient.id);
    const rows = AdelanteEHR.listAdministrations(patient.id)
      .filter((a) => monthKey(a.scheduledAt, tz) === month)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((administration) => ({
        administration,
        order: orders.find((o) => o.id === administration.orderId),
      }));
    sections.push({ key: "mar", label: PRINT_SECTION_LABEL.mar, month, rows });
  }

  if (flags.notes && gate("notes")) {
    const from =
      flags.notesScope === "range"
        ? flags.notesFrom
        : flags.notesScope === "current"
          ? currentEpisodeStart(patient)
          : undefined;
    const to = flags.notesScope === "range" ? flags.notesTo : undefined;
    const scopeLabel =
      flags.notesScope === "all"
        ? "All notes on file"
        : flags.notesScope === "range"
          ? `${from ?? "earliest"} to ${to ?? "today"}`
          : "Current episode";

    const entries: PrintNoteEntry[] = (patient.progressNotes ?? [])
      .filter((n) => {
        const status = noteStatus(n);
        return status === "signed" || status === "cosigned";
      })
      .filter((n) => inRange(n.date, from, to))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .map((note) => {
        const authorLabel = authorLabelFor(note);
        const exportGate = noteExportGate(note, role, patient);
        if (!exportGate.allowed) {
          const entry: PrintNoteEntry = {
            note,
            masked: true,
            authorLabel,
          };
          entry.maskReason = isNoteSudSensitive(note)
            ? (exportGate.reason ?? "42 CFR Part 2 — consent required")
            : exportGate.reason;
          return entry;
        }
        return {
          note,
          masked: false,
          blocks: buildNoteDocumentModel({ note, patient, role, authorLabel }),
          authorLabel,
        } satisfies PrintNoteEntry;
      });
    sections.push({ key: "notes", label: PRINT_SECTION_LABEL.notes, scopeLabel, entries });
  }

  return {
    patient,
    facilityName: AdelanteEHR.currentFacility(patient.id)?.name ?? "Adelante Health",
    role,
    printedAt: now.toISOString(),
    sections,
    denied,
  };
}