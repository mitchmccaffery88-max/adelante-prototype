import { describe, expect, it, beforeEach } from "vitest";
import { AdelanteEHR, noteStatus, isNoteSudSensitive } from "@/lib/ehr";
import { canSignNotes, cosignerCandidates, isMyCosign, requiresCosign } from "@/lib/notes";

const PATIENT = AdelanteEHR.listPatients()[0]!.id;

function draft(category?: "sud") {
  const created = AdelanteEHR.addProgressNote(PATIENT, {
    clinicianId: "c1",
    date: new Date().toISOString(),
    sessionType: "individual",
    subjective: "s",
    objective: "",
    assessment: "",
    plan: "",
    category,
    authorSource: "human",
    status: "draft",
  });
  if (!created) throw new Error("addProgressNote did not return a note");
  return created;
}

describe("note signer eligibility", () => {
  it("lets pmhnp and therapist self-sign", () => {
    expect(canSignNotes("pmhnp")).toBe(true);
    expect(canSignNotes("therapist")).toBe(true);
    expect(requiresCosign("pmhnp")).toBe(false);
  });
  it("blocks ecm_provider and peer_specialist from self-signing", () => {
    expect(canSignNotes("ecm_provider")).toBe(false);
    expect(requiresCosign("ecm_provider")).toBe(true);
    expect(requiresCosign("peer_specialist")).toBe(true);
  });
  it("offers a non-empty cosigner pool", () => {
    expect(cosignerCandidates().length).toBeGreaterThan(0);
  });
});

describe("note lifecycle", () => {
  it("defaults new notes to human-authored drafts", () => {
    const n = draft();
    expect(n.authorSource).toBe("human");
    expect(noteStatus(n)).toBe("draft");
  });

  it("pmhnp self-sign goes straight to signed", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Dr. Bagga",
      role: "pmhnp",
      attested: true,
    });
    expect(noteStatus(n)).toBe("signed");
    expect(n.cosignRequired).toBe(false);
  });

  it("requires attestation", () => {
    const n = draft();
    expect(() =>
      AdelanteEHR.signProgressNote(PATIENT, n.id, {
        signedBy: "Dr. Bagga",
        role: "pmhnp",
        attested: false,
      }),
    ).toThrow(/[Aa]ttestation/);
  });

  it("ecm_provider sign routes to cosign_pending", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "ecm_provider",
      attested: true,
      cosignRequired: true,
      cosignRole: ["therapist"],
    });
    expect(noteStatus(n)).toBe("cosign_pending");
    expect(AdelanteEHR.listNotesAwaitingCosign().some((r) => r.note.id === n.id)).toBe(true);
  });

  it("ecm_provider cannot sign without a cosigner", () => {
    const n = draft();
    expect(() =>
      AdelanteEHR.signProgressNote(PATIENT, n.id, {
        signedBy: "Maria CM",
        role: "ecm_provider",
        attested: true,
        cosignRequired: false,
      }),
    ).toThrow(/cosigner/);
  });

  it("cosign completes the note; wrong role is rejected", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "ecm_provider",
      attested: true,
      cosignRequired: true,
      cosignRole: ["therapist"],
    });
    expect(() =>
      AdelanteEHR.cosignProgressNote(PATIENT, n.id, {
        cosignedBy: "Dr. Bagga",
        role: "pmhnp",
        attested: true,
      }),
    ).toThrow(/different cosigning role/);
    AdelanteEHR.cosignProgressNote(PATIENT, n.id, {
      cosignedBy: "Christi",
      role: "therapist",
      attested: true,
      comment: "ok",
    });
    expect(noteStatus(n)).toBe("cosigned");
    expect(n.cosignComment).toBe("ok");
  });

  it("decline requires a 3+ char reason and returns the note to draft", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "ecm_provider",
      attested: true,
      cosignRequired: true,
    });
    expect(() =>
      AdelanteEHR.declineProgressNoteCosign(PATIENT, n.id, {
        declinedBy: "Christi",
        role: "therapist",
        reason: "no",
      }),
    ).toThrow(/reason/);
    AdelanteEHR.declineProgressNoteCosign(PATIENT, n.id, {
      declinedBy: "Christi",
      role: "therapist",
      reason: "Assessment section is incomplete",
    });
    expect(noteStatus(n)).toBe("draft");
    expect(n.signedAt).toBeUndefined();
    expect(n.declineReason).toMatch(/incomplete/);
    expect(AdelanteEHR.listNotesAwaitingCosign().some((r) => r.note.id === n.id)).toBe(false);
  });

  it("records the absent order cascade in the audit log", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "ecm_provider",
      attested: true,
      cosignRequired: true,
    });
    AdelanteEHR.declineProgressNoteCosign(PATIENT, n.id, {
      declinedBy: "Christi",
      role: "therapist",
      reason: "Needs revision",
    });
    const entry = AdelanteEHR.listAuditEvents({ patientId: PATIENT })
      .filter((e) => e.action === "note_cosign_declined")
      .at(-1);
    expect(entry?.detail).toMatchObject({
      ordersVoided: 0,
      orderCascade: "unavailable_no_note_order_link",
    });
  });
});

describe("cosign inbox split + SUD masking shape", () => {
  it("isMyCosign matches by role and excludes the signer", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "ecm_provider",
      attested: true,
      cosignRequired: true,
      cosignRole: ["therapist"],
    });
    expect(isMyCosign(n, { role: "therapist", staffName: "Christi" })).toBe(true);
    expect(isMyCosign(n, { role: "pmhnp", staffName: "Dr. Bagga" })).toBe(false);
    expect(isMyCosign(n, { role: "ecm_provider", staffName: "Maria CM" })).toBe(false);
  });

  it("empty cosignRole means any eligible clinical role", () => {
    const n = draft();
    AdelanteEHR.signProgressNote(PATIENT, n.id, {
      signedBy: "Maria CM",
      role: "ecm_provider",
      attested: true,
      cosignRequired: true,
    });
    expect(isMyCosign(n, { role: "pmhnp", staffName: "Dr. Bagga" })).toBe(true);
    expect(isMyCosign(n, { role: "therapist", staffName: "Christi" })).toBe(true);
  });

  it("SUD sensitivity is independent of authorSource", () => {
    const a = draft("sud");
    expect(isNoteSudSensitive(a)).toBe(true);
    a.authorSource = "ai_draft";
    expect(isNoteSudSensitive(a)).toBe(true);
    expect(isNoteSudSensitive(draft())).toBe(false);
  });
});
