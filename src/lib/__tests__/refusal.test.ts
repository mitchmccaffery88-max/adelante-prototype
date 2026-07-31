// §MAR Phase 3 — Refusal legal document + escalation.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  DECLINE_REASONS,
  capacityFlagsFrom,
  isMinorPatient,
  medClassGuess,
  refusalFinalizeProblems,
  signatureMetrics,
  isValidSignature,
  validateEscalationTime,
  witnessRequiredFor,
} from "@/lib/refusal";
import { deriveMarDay } from "@/lib/mar";
import { facilityDateKey } from "@/lib/facilityTime";

const NURSE = "N. Ramirez";
const patientId = () => AdelanteEHR.listPatients()[0].id;
const today = () => facilityDateKey(new Date(), undefined);

function signedOrder(extra: Record<string, unknown> = {}) {
  const pid = patientId();
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName: "sertraline 50 MG Oral Tablet",
    frequencyCode: "BID",
    createdBy: NURSE,
    ...extra,
  } as never);
  AdelanteEHR.signOrders(pid, [draft.id], NURSE);
  return { pid, orderId: draft.id };
}

/** Chart a refusal on this order's first due slot today and return the form. */
function refuse(pid: string, orderId: string, scheduledAt?: string) {
  const at =
    scheduledAt ??
    deriveMarDay(AdelanteEHR.getPatient(pid)!, today()).slots.find((s) => s.order.id === orderId)!
      .scheduledAt;
  const admin = AdelanteEHR.chartDose(
    pid,
    orderId,
    at,
    "refused",
    "Patient declined",
    NURSE,
    `batch_${Math.random().toString(36).slice(2)}`,
    "charted late in test",
  );
  return AdelanteEHR.createRefusalFormShell(pid, admin.id, NURSE);
}

const goodSig = "data:image/png;base64,AAAA";

describe("medClassGuess", () => {
  it("classifies each ported category and falls back to generic", () => {
    expect(medClassGuess("sertraline 50 MG Oral Tablet")).toBe("psychiatric");
    expect(medClassGuess("warfarin sodium 5 MG")).toBe("anticoagulant");
    expect(medClassGuess("oxycodone 5 MG")).toBe("controlled");
    expect(medClassGuess("amoxicillin 500 MG capsule")).toBe("antibiotic");
    expect(medClassGuess("lisinopril 10 MG")).toBe("*");
    expect(medClassGuess(undefined)).toBe("*");
  });

  it("prefers the higher-risk class when a drug reads as both", () => {
    // Lorazepam is psychotropic AND controlled — controlled disclosure wins.
    expect(medClassGuess("lorazepam 1 MG tablet")).toBe("controlled");
  });
});

describe("capacity heuristic (adaptation, not a clean port)", () => {
  it("matches active capacity/guardian/conservator alert labels only", () => {
    const base = { patientId: "p", severity: "warning" as const, enteredBy: "x", enteredAt: "" };
    expect(
      capacityFlagsFrom([
        { ...base, id: "1", label: "Decision-making capacity concern", active: true },
        { ...base, id: "2", label: "Conservatorship in place", active: true },
        { ...base, id: "3", label: "Fall Risk", active: true },
        { ...base, id: "4", label: "Guardian involved", active: false },
      ]),
    ).toEqual(["Decision-making capacity concern", "Conservatorship in place"]);
  });
});

describe("guardian / minor detection", () => {
  it("flags patients under 18 and not those over", () => {
    const y = new Date().getUTCFullYear();
    expect(isMinorPatient({ dob: `${y - 15}-01-01` })).toBe(true);
    expect(isMinorPatient({ dob: `${y - 40}-01-01` })).toBe(false);
    expect(isMinorPatient({ dob: "" })).toBe(false);
  });
});

describe("signature anti-tap-fraud", () => {
  it("rejects a tap and accepts a real multi-stroke mark", () => {
    expect(isValidSignature(signatureMetrics([[{ x: 0, y: 0 }]]))).toBe(false);
    expect(
      isValidSignature(
        signatureMetrics([
          [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
          ],
        ]),
      ),
    ).toBe(false); // long enough, but a single stroke
    expect(
      isValidSignature(
        signatureMetrics([
          [
            { x: 0, y: 0 },
            { x: 60, y: 0 },
          ],
          [
            { x: 0, y: 10 },
            { x: 40, y: 10 },
          ],
        ]),
      ),
    ).toBe(true);
  });
});

describe("refusal form shell creation", () => {
  it("is created for a refused dose with class, risk snapshot, and version", () => {
    const { pid, orderId } = signedOrder();
    const form = refuse(pid, orderId);
    expect(form.status).toBe("pending_signature");
    expect(form.medClass).toBe("psychiatric");
    expect(form.riskTextVersion).toBe("v1");
    expect(form.riskTextSnapshot.length).toBeGreaterThan(50);
    expect(form.attestationMethod).toBe("checkbox_only");
    expect(AdelanteEHR.pendingRefusalForms(pid).some((f) => f.id === form.id)).toBe(true);
  });

  it("refuses to document a dose that was not refused", () => {
    const { pid, orderId } = signedOrder();
    const slot = deriveMarDay(AdelanteEHR.getPatient(pid)!, today()).slots.find(
      (s) => s.order.id === orderId,
    )!;
    const admin = AdelanteEHR.chartDose(
      pid,
      orderId,
      slot.scheduledAt,
      "given",
      undefined,
      NURSE,
      "b1",
      "late in test",
    );
    expect(() => AdelanteEHR.createRefusalFormShell(pid, admin.id, NURSE)).toThrow(/refused dose/i);
  });

  it("is idempotent per administration", () => {
    const { pid, orderId } = signedOrder();
    const first = refuse(pid, orderId);
    expect(AdelanteEHR.createRefusalFormShell(pid, first.administrationId, NURSE).id).toBe(
      first.id,
    );
  });
});

describe("finalize validation (ported canFinalize)", () => {
  const form = { languageCode: "en", capacityFlagsAtSigning: [] as string[] };

  it("blocks without nurse attestation", () => {
    expect(
      refusalFinalizeProblems(form, {
        nurseAttested: false,
        patientMode: "signed",
        patientSignatureDataUrl: goodSig,
        nurseSignatureDataUrl: goodSig,
      }),
    ).toContain("Nurse attestation is required.");
  });

  it("blocks a decline with no reason", () => {
    expect(
      refusalFinalizeProblems(form, {
        nurseAttested: true,
        patientMode: "declined",
        witnessStaffName: "Dr. Marisol Reyes",
        nurseSignatureDataUrl: goodSig,
      }),
    ).toContain("Select why the patient did not sign.");
  });

  it("blocks without the nurse signature", () => {
    expect(
      refusalFinalizeProblems(form, {
        nurseAttested: true,
        patientMode: "signed",
        patientSignatureDataUrl: goodSig,
      }),
    ).toContain("The nurse signature is required.");
  });

  it("requires an interpreter method for a non-English form, with justification when absent", () => {
    const es = { languageCode: "es", capacityFlagsAtSigning: [] as string[] };
    const base = {
      nurseAttested: true,
      patientMode: "signed" as const,
      patientSignatureDataUrl: goodSig,
      nurseSignatureDataUrl: goodSig,
    };
    expect(refusalFinalizeProblems(es, base)).toContain(
      "Select how interpretation was provided.",
    );
    expect(
      refusalFinalizeProblems(es, { ...base, interpreterMethod: "not_available" }),
    ).toContain("Justify proceeding without an interpreter.");
    expect(refusalFinalizeProblems(es, { ...base, interpreterMethod: "phone" })).toEqual([]);
  });

  it("requires a witness when a NON-flagged patient declines, but not a flagged one", () => {
    expect(witnessRequiredFor("declined", [])).toBe(true);
    expect(witnessRequiredFor("declined", ["Capacity concern"])).toBe(false);
    expect(witnessRequiredFor("signed", [])).toBe(false);

    const payload = {
      nurseAttested: true,
      patientMode: "declined" as const,
      patientDeclineReason: DECLINE_REASONS[0],
      nurseSignatureDataUrl: goodSig,
    };
    expect(refusalFinalizeProblems(form, payload)).toContain(
      "A witness is required when the patient declines to sign.",
    );
    expect(
      refusalFinalizeProblems({ ...form, capacityFlagsAtSigning: ["Capacity concern"] }, payload),
    ).toEqual([]);
  });
});

describe("finalizeRefusalForm", () => {
  it("rejects an incomplete payload and accepts a complete one", () => {
    const { pid, orderId } = signedOrder();
    const shell = refuse(pid, orderId);
    expect(() =>
      AdelanteEHR.finalizeRefusalForm(pid, shell.id, { nurseAttested: false }, NURSE),
    ).toThrow(/attestation/i);

    const done = AdelanteEHR.finalizeRefusalForm(
      pid,
      shell.id,
      {
        nurseAttested: true,
        patientMode: "declined",
        patientDeclineReason: DECLINE_REASONS[0],
        witnessStaffName: "Dr. Marisol Reyes",
        nurseSignatureDataUrl: goodSig,
      },
      NURSE,
    );
    expect(done.status).toBe("finalized");
    expect(done.witnessRequired).toBe(true);
    expect(done.patientSigned).toBe(false);
    expect(done.finalizedBy).toBe(NURSE);
    expect(AdelanteEHR.pendingRefusalForms(pid).some((f) => f.id === shell.id)).toBe(false);
    expect(() =>
      AdelanteEHR.finalizeRefusalForm(pid, shell.id, { nurseAttested: true }, NURSE),
    ).toThrow(/already finalized/i);
  });
});

describe("3-in-7-days escalation", () => {
  it("triggers only at the third live refusal in the window", () => {
    const { pid, orderId } = signedOrder({ frequencyCode: "TID" });
    const slots = deriveMarDay(AdelanteEHR.getPatient(pid)!, today()).slots.filter(
      (s) => s.order.id === orderId,
    );
    expect(slots.length).toBeGreaterThanOrEqual(3);
    refuse(pid, orderId, slots[0].scheduledAt);
    expect(AdelanteEHR.refusalEscalationDue(pid, orderId)).toBe(false);
    refuse(pid, orderId, slots[1].scheduledAt);
    expect(AdelanteEHR.refusalEscalationDue(pid, orderId)).toBe(false);
    refuse(pid, orderId, slots[2].scheduledAt);
    expect(AdelanteEHR.refusalEscalationDue(pid, orderId)).toBe(true);
    expect(AdelanteEHR.refusalsInWindow(pid, orderId)).toHaveLength(3);
  });

  it("validates the follow-up window and requires a deferral reason", () => {
    const now = new Date();
    expect(validateEscalationTime(new Date(now.getTime() + 60_000).toISOString(), now)).toMatch(
      /at least/i,
    );
    expect(
      validateEscalationTime(new Date(now.getTime() + 96 * 3600_000).toISOString(), now),
    ).toMatch(/within/i);
    expect(
      validateEscalationTime(new Date(now.getTime() + 3600_000).toISOString(), now),
    ).toBeUndefined();

    const { pid, orderId } = signedOrder();
    const form = refuse(pid, orderId);
    expect(() =>
      AdelanteEHR.recordRefusalEscalation(
        pid,
        { formId: form.id, orderId, decision: "deferred" },
        NURSE,
      ),
    ).toThrow(/deferral reason/i);
    AdelanteEHR.recordRefusalEscalation(
      pid,
      {
        formId: form.id,
        orderId,
        decision: "scheduled",
        discipline: "psychiatrist",
        followUpAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
      },
      NURSE,
    );
    const audit = AdelanteEHR.listAuditEvents({ patientId: pid });
    expect(audit.some((e) => e.action === "refusal_escalation_scheduled")).toBe(true);
    expect(audit.some((e) => e.action === "refusal_form_created")).toBe(true);
  });
});
