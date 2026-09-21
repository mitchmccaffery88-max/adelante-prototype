import { describe, expect, it } from "vitest";
import { AdelanteEHR, noteStatus } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { listUnsignedWork } from "@/lib/unsignedWork";
import { noteSignAuthorization } from "@/lib/notes";
import { signUnsignedWorkRow } from "@/lib/noteSignFlow";
import { STAFF_ROSTER, getStaffMember, supervisionStatus } from "@/lib/roles";

const PATIENT = AdelanteEHR.listPatients()[0]!.id;

function draft(clinicianId: string, appointmentId?: string) {
  const n = AdelanteEHR.addProgressNote(PATIENT, {
    clinicianId,
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: "s",
    objective: "",
    assessment: "",
    plan: "",
    authorSource: "human",
    status: "draft",
    ...(appointmentId ? { appointmentId } : {}),
  });
  if (!n) throw new Error("no note");
  return n;
}

const therapist = STAFF_ROSTER.find((m) => m.role === "therapist" && m.clinicianId)!;
const otherTherapist = STAFF_ROSTER.find(
  (m) => m.role === "therapist" && m.id !== therapist.id,
)!;

function actorFor(id: string) {
  const m = getStaffMember(id)!;
  return {
    role: m.role,
    staffId: m.id,
    staffName: m.name,
    ...(m.clinicianId ? { clinicianId: m.clinicianId } : {}),
  };
}

describe("unsigned work consolidation", () => {
  it("is one derivation: scoped list is a subset of the unscoped list", () => {
    const n = draft(therapist.clinicianId!);
    const all = listUnsignedWork();
    const mine = listUnsignedWork({ authorId: therapist.clinicianId! });
    expect(all.some((r) => r.id === n.id)).toBe(true);
    expect(mine.some((r) => r.id === n.id)).toBe(true);
    expect(mine.every((r) => all.some((a) => a.id === r.id))).toBe(true);
    expect(listUnsignedWork({ authorId: "nobody-at-all" })).toEqual([]);
  });

  it("keeps draft notes and undocumented encounters as distinct kinds", () => {
    const attended = AdelanteEHR.listAppointments().filter((a) => a.status === "attended");
    const rows = listUnsignedWork();
    // An attended appointment only appears when NO note is linked to it.
    for (const a of attended) {
      const documented = (AdelanteEHR.getPatient(a.patientId)?.progressNotes ?? []).some(
        (n) => n.appointmentId === a.id,
      );
      const listed = rows.some((r) => r.kind === "undocumented_encounter" && r.id === a.id);
      expect(listed).toBe(!documented);
    }
    // A draft with no appointment still shows up — notes are not scheduling.
    const n = draft(therapist.clinicianId!);
    const row = listUnsignedWork().find((r) => r.id === n.id)!;
    expect(row.kind).toBe("draft_note");
    expect(row.appointment).toBeUndefined();
  });

  it("drops a note from every surface once it is signed", () => {
    const n = draft(therapist.clinicianId!);
    const res = signUnsignedWorkRow(
      listUnsignedWork().find((r) => r.id === n.id)!,
      actorFor(therapist.id),
    );
    expect(res.ok).toBe(true);
    expect(listUnsignedWork().some((r) => r.id === n.id)).toBe(false);
    expect(listUnsignedWork({ authorId: therapist.clinicianId! }).some((r) => r.id === n.id)).toBe(
      false,
    );
  });
});

describe("signature attribution", () => {
  it("records the acting user, not the note's original clinician", () => {
    const author = therapist;
    const supervisorId = supervisionStatus(author.id).supervisor?.id;
    const signer = supervisorId ? getStaffMember(supervisorId)! : author;
    const n = draft(author.clinicianId!);
    const res = signUnsignedWorkRow(
      listUnsignedWork().find((r) => r.id === n.id)!,
      actorFor(signer.id),
    );
    expect(res.ok).toBe(true);
    expect(n.signedBy).toBe(signer.name);
    expect(noteStatus(n)).toBe("signed");
  });

  it("blocks a clinician who is neither the author nor their supervisor", () => {
    const n = draft(therapist.clinicianId!);
    const intruder = actorFor(otherTherapist.id);
    const auth = noteSignAuthorization(n, intruder);
    expect(auth.allowed).toBe(false);
    expect(auth.reason).toMatch(/author or their supervising/i);
    const res = signUnsignedWorkRow(listUnsignedWork().find((r) => r.id === n.id)!, intruder);
    expect(res.ok).toBe(false);
    expect(noteStatus(n)).toBe("draft");
  });

  it("refuses to sign an encounter that has no note written", () => {
    const row = listUnsignedWork().find((r) => r.kind === "undocumented_encounter");
    if (!row) return;
    const res = signUnsignedWorkRow(row, actorFor(therapist.id));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no note/i);
  });

  it("still advances the linked claim, attributed to the signer", () => {
    const appt = AdelanteEHR.listAppointments().find(
      (a) => a.status === "attended" && !AdelanteEHRExt.isNoteSigned(a.id),
    );
    if (!appt) return;
    const claim = AdelanteEHRExt.upsertClaimFromEncounter(appt.id);
    const author = getStaffMember(
      STAFF_ROSTER.find((m) => m.clinicianId === appt.clinicianId)?.id ?? therapist.id,
    )!;
    const n = draft(author.clinicianId ?? author.id, appt.id);
    // Note is written against this patient's chart; only sign if same patient.
    if (appt.patientId !== PATIENT) return;
    const res = signUnsignedWorkRow(
      listUnsignedWork().find((r) => r.id === n.id)!,
      actorFor(author.id),
    );
    expect(res.ok).toBe(true);
    expect(AdelanteEHRExt.isNoteSigned(appt.id)).toBe(true);
    expect(["signed", "submitted", "paid", "denied"]).toContain(claim.state);
  });
});
