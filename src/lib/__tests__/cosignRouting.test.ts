import { describe, expect, it, afterEach } from "vitest";
import { attest } from "@/test/claimSigning";
import { AdelanteEHR, noteCosignOwnership, asamCosignOwnership, demoScenarioPatientId, noteStatus } from "@/lib/ehr";
import { assignSupervisor } from "@/lib/roles";
import { isMyCosign } from "@/lib/notes";

const REYES = { cosignedBy: "Dr. Marisol Reyes", cosignedById: "c1", role: "therapist" };
const OKAFOR = { cosignedBy: "Dr. James Okafor", cosignedById: "c2", role: "therapist" };
const CC = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" };

function kaylaNote(pid: string) {
  const n = AdelanteEHR.addProgressNote(pid, {
    clinicianId: "c4", date: new Date().toISOString(), sessionType: "individual",
    subjective: "s", objective: "", assessment: "", plan: "", authorSource: "human", status: "draft",
  })!;
  AdelanteEHR.signProgressNote(pid, n.id, {
    signedBy: "Kayla Nguyen", signedById: "c4", role: "clinical_trainee", attested: true, cosignRequired: true,
  });
  return n;
}
const PID = AdelanteEHR.listPatients()[0]!.id;

afterEach(() => {
  assignSupervisor("s-tr1", "s-th1");
});

describe("cosign routed to the assigned supervisor", () => {
  it("only the assigned supervisor can cosign (store-enforced)", () => {
    const n = kaylaNote(PID);
    const own = noteCosignOwnership(n);
    expect(own).toMatchObject({ kind: "owner", staffId: "s-th1" });
    expect(isMyCosign(n, { role: "therapist", staffName: "Dr. James Okafor", staffId: "s-th2", clinicianId: "c2" })).toBe(false);
    expect(isMyCosign(n, { role: "therapist", staffName: "Dr. Marisol Reyes", staffId: "s-th1", clinicianId: "c1" })).toBe(true);
    expect(() =>
      AdelanteEHR.cosignProgressNote(PID, n.id, { ...OKAFOR, attestation: attest("progress_note_supervisor_sign", OKAFOR.cosignedBy) }),
    ).toThrow(/Only Dr. Marisol Reyes/);
    expect(() =>
      AdelanteEHR.declineProgressNoteCosign(PID, n.id, { declinedBy: OKAFOR.cosignedBy, declinedById: "c2", role: "therapist", reason: "nope nope" }),
    ).toThrow(/Only Dr. Marisol Reyes/);
    AdelanteEHR.cosignProgressNote(PID, n.id, { ...REYES, attestation: attest("progress_note_supervisor_sign", REYES.cosignedBy) });
    expect(noteStatus(n)).toBe("cosigned");
  });

  it("coordinator override with a reason reassigns ownership, audited", () => {
    const n = kaylaNote(PID);
    expect(() => AdelanteEHR.reassignNoteCosign(PID, n.id, "s-th2", CC, "")).toThrow(/reason/);
    expect(() =>
      AdelanteEHR.reassignNoteCosign(PID, n.id, "s-th2", { staffId: "s-th1", name: "Dr. Marisol Reyes", role: "therapist" }, "on leave"),
    ).toThrow(/coordinator/);
    AdelanteEHR.reassignNoteCosign(PID, n.id, "s-th2", CC, "Dr. Reyes on leave");
    expect(noteCosignOwnership(n)).toMatchObject({ kind: "owner", staffId: "s-th2", via: "override" });
    expect(() =>
      AdelanteEHR.cosignProgressNote(PID, n.id, { ...REYES, attestation: attest("progress_note_supervisor_sign", REYES.cosignedBy) }),
    ).toThrow(/Only Dr. James Okafor/);
    const audit = AdelanteEHR.listAuditEvents({ patientId: PID }).filter((e) => e.action === "note_cosign_reassigned").at(-1);
    expect(audit?.detail).toMatchObject({ toId: "s-th2", reason: "Dr. Reyes on leave", fromId: "s-th1" });
    AdelanteEHR.cosignProgressNote(PID, n.id, { ...OKAFOR, attestation: attest("progress_note_supervisor_sign", OKAFOR.cosignedBy) });
    expect(noteStatus(n)).toBe("cosigned");
  });

  it("no supervisor → needs-a-supervisor state, nobody can cosign, not billable", () => {
    assignSupervisor("s-tr1", null);
    const n = kaylaNote(PID);
    expect(noteCosignOwnership(n).kind).toBe("needs_supervisor");
    expect(isMyCosign(n, { role: "therapist", staffName: "Dr. Marisol Reyes", staffId: "s-th1", clinicianId: "c1" })).toBe(false);
    expect(() =>
      AdelanteEHR.cosignProgressNote(PID, n.id, { ...REYES, attestation: attest("progress_note_supervisor_sign", REYES.cosignedBy) }),
    ).toThrow(/no assigned LPHA supervisor/);
    // Banner and ownership agree: assigning Reyes makes her the owner.
    assignSupervisor("s-tr1", "s-th1");
    expect(noteCosignOwnership(n)).toMatchObject({ kind: "owner", staffId: "s-th1" });
  });

  it("seeds: Kayla's note is owned by Reyes; Owen's needs a supervisor", () => {
    const rows = AdelanteEHR.listNotesAwaitingCosign();
    const elena = demoScenarioPatientId("mh_only");
    const paloma = demoScenarioPatientId("medication");
    expect(rows.find((r) => r.patient.id === elena && r.note.clinicianId === "c4")).toBeTruthy();
    const owen = rows.find((r) => r.patient.id === paloma && r.note.clinicianId === "s-tr2");
    expect(owen && noteCosignOwnership(owen.note).kind).toBe("needs_supervisor");
  });

  it("decline removes draft orders from the visit and flags active ones", () => {
    const n = kaylaNote(PID);
    const p = AdelanteEHR.listPatients().find((x) => x.id === PID)!;
    p.orders = [
      ...(p.orders ?? []),
      { id: "o-draft-x", patientId: PID, drugName: "Test A", status: "draft", sourceNoteId: n.id } as never,
      { id: "o-live-x", patientId: PID, drugName: "Test B", status: "signed", sourceNoteId: n.id } as never,
    ];
    AdelanteEHR.declineProgressNoteCosign(PID, n.id, { declinedBy: "Dr. Marisol Reyes", declinedById: "s-th1", role: "therapist", reason: "Plan incomplete" });
    const after = AdelanteEHR.listPatients().find((x) => x.id === PID)!.orders ?? [];
    expect(after.find((o) => o.id === "o-draft-x")).toBeUndefined();
    expect(after.find((o) => o.id === "o-live-x")?.sourceNoteDeclined?.reason).toBe("Plan incomplete");
  });
});

describe("ASAM co-sign follows the same rule", () => {
  it("trainee-authored ASAM is owned by the assigned supervisor", () => {
    const asam = {
      id: "a-x", version: 1, status: "cosign_pending", dimensions: [], diagnosisCodes: [],
      authoredBy: { staffId: "s-tr1", name: "Kayla Nguyen", role: "clinical_trainee" },
      authoredAt: new Date().toISOString(), triggerReasons: [],
    } as never;
    const p = AdelanteEHR.listPatients().find((x) => x.id === PID)!;
    p.asamAssessments = [...(p.asamAssessments ?? []), asam];
    expect(asamCosignOwnership(asam)).toMatchObject({ kind: "owner", staffId: "s-th1" });
    const OK = { staffId: "s-th2", name: "Dr. James Okafor", role: "therapist" as const, clinicianId: "c2" };
    expect(() => AdelanteEHR.cosignAsam(PID, "a-x", OK, attest("asam_supervisor_sign", OK.name))).toThrow(/Only Dr. Marisol Reyes/);
    AdelanteEHR.reassignAsamCosign(PID, "a-x", "s-th2", CC, "Coverage this week");
    expect(asamCosignOwnership(asam)).toMatchObject({ staffId: "s-th2", via: "override" });
  });
});
