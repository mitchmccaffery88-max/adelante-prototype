// §EHR audit Phase 1a — ONE derivation of "documentation that still needs a
// signature", shared by the Inbox Unsigned tab, /notes-queue and the
// /clinician queue tile.
//
// WHY THIS IS NOT A SINGLE MERGED CONCEPT
// ---------------------------------------
// The investigation found two genuinely distinct real things, not one thing
// described twice:
//
//   1. A DRAFT PROGRESS NOTE (`Patient.progressNotes`, `noteStatus === "draft"`).
//      A documentation artifact that exists independently of scheduling:
//      `ProgressNote.appointmentId` is OPTIONAL, and phone / check-in / group
//      notes are routinely written with no appointment at all. A draft can also
//      exist before the appointment is marked attended.
//
//   2. An ATTENDED APPOINTMENT WITH NO NOTE WRITTEN YET. A billing-relevant
//      encounter awaiting documentation. Nothing has been drafted, so there is
//      literally nothing to sign — the real next action is "write the note".
//
// They cannot be collapsed: neither set contains the other. What they DO share
// is a real join key (`ProgressNote.appointmentId`), so the honest
// consolidation is one list with an explicit `kind`, derived from
// `AdelanteEHR` only. The separate `noteSignatures` array in `ehr-ext` stops
// being an independent truth and becomes a mirror written when a chart note is
// signed (claims still advance off it — see `noteSignFlow.ts`).

import {
  AdelanteEHR,
  noteStatus,
  type Appointment,
  type Patient,
  type ProgressNote,
} from "@/lib/ehr";

export type UnsignedWorkKind = "draft_note" | "undocumented_encounter";

export interface UnsignedWorkRow {
  kind: UnsignedWorkKind;
  /** Stable row id: note id, or appt id for an undocumented encounter. */
  id: string;
  patient: Patient;
  note?: ProgressNote;
  appointment?: Appointment;
  /** The author/owner token — `ProgressNote.clinicianId` or `Appointment.clinicianId`. */
  authorId: string;
  /** Note date, or appointment start. */
  date: string;
  ageDays: number;
}

/** A note counts as unsigned when nobody has attested to it yet. */
export function isUnsignedDraft(note: ProgressNote): boolean {
  return noteStatus(note) === "draft" && !note.signedBy;
}

export function listUnsignedWork(
  opts: { authorId?: string; kinds?: UnsignedWorkKind[] } = {},
  now: number = Date.now(),
): UnsignedWorkRow[] {
  const kinds = opts.kinds ?? (["draft_note", "undocumented_encounter"] as UnsignedWorkKind[]);
  const author = (opts.authorId ?? "").trim();
  const patients = AdelanteEHR.listPatients();
  const appts = AdelanteEHR.listAppointments();
  const rows: UnsignedWorkRow[] = [];
  const age = (iso: string) => {
    const ts = Date.parse(iso);
    return Number.isFinite(ts) ? Math.max(0, Math.floor((now - ts) / 86_400_000)) : 0;
  };

  for (const p of patients) {
    const notes = p.progressNotes ?? [];

    if (kinds.includes("draft_note")) {
      for (const n of notes) {
        if (!isUnsignedDraft(n)) continue;
        if (author && n.clinicianId !== author) continue;
        rows.push({
          kind: "draft_note",
          id: n.id,
          patient: p,
          note: n,
          ...(n.appointmentId ? { appointment: appts.find((a) => a.id === n.appointmentId) } : {}),
          authorId: n.clinicianId,
          date: n.date,
          ageDays: age(n.date),
        });
      }
    }

    if (kinds.includes("undocumented_encounter")) {
      for (const a of appts) {
        if (a.patientId !== p.id || a.status !== "attended") continue;
        if (author && a.clinicianId !== author) continue;
        // Any note linked to this encounter — draft or signed — means the
        // encounter IS documented; its signature state is the note's business.
        if (notes.some((n) => n.appointmentId === a.id)) continue;
        rows.push({
          kind: "undocumented_encounter",
          id: a.id,
          patient: p,
          appointment: a,
          authorId: a.clinicianId,
          date: a.start,
          ageDays: age(a.start),
        });
      }
    }
  }

  return rows.sort((x, y) => y.ageDays - x.ageDays || x.date.localeCompare(y.date));
}

/** Count used by the /clinician tile and the Inbox badge — same derivation. */
export function unsignedWorkCount(authorId?: string): number {
  return listUnsignedWork(authorId ? { authorId } : {}).length;
}
