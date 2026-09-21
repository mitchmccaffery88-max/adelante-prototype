// §EHR audit Phase 1d — the shared attestation/signature primitive.
import { describe, expect, it } from "vitest";
import {
  ATTESTATION_STATEMENTS,
  attestationBlockers,
  attestationStatement,
  buildAttestationRecord,
  canBuildAttestation,
  emptyAttestationDraft,
  mergeBlockers,
  metricsFromStrokes,
  type AttestationDraft,
} from "@/lib/attestation";
import { SIGNATURE_MIN_STROKES } from "@/lib/refusal";
import { noteAttestationStatement } from "@/lib/noteSignFlow";

const drawn: AttestationDraft = {
  attested: true,
  signatureDataUrl: "data:image/png;base64,AAA",
  metrics: { totalLength: 300, strokeCount: 3 },
};

describe("attestation primitive — blockers", () => {
  it("blocks an empty draft on both the checkbox and the mark", () => {
    const b = attestationBlockers(emptyAttestationDraft());
    expect(b.map((x) => x.code)).toEqual(["attestation_unchecked", "signature_missing"]);
    expect(canBuildAttestation(emptyAttestationDraft())).toBe(false);
  });

  it("rejects a tap-sized mark using the shared anti-tap-fraud thresholds", () => {
    const tap = metricsFromStrokes([[{ x: 1, y: 1 }]]);
    expect(tap.strokeCount).toBeLessThan(SIGNATURE_MIN_STROKES);
    const b = attestationBlockers({
      attested: true,
      signatureDataUrl: "data:image/png;base64,AAA",
      metrics: tap,
    });
    expect(b.map((x) => x.code)).toEqual(["signature_invalid"]);
  });

  it("clears once the statement is confirmed and a real mark is captured", () => {
    expect(attestationBlockers(drawn)).toEqual([]);
  });

  it("merges domain blockers ahead of ceremony and dedups by code", () => {
    const merged = mergeBlockers(
      [{ code: "cosigner_missing", message: "Choose a cosigner." }],
      [{ code: "cosigner_missing", message: "dupe" }],
      attestationBlockers(emptyAttestationDraft()),
    );
    expect(merged.map((x) => x.code)).toEqual([
      "cosigner_missing",
      "attestation_unchecked",
      "signature_missing",
    ]);
  });
});

describe("attestation primitive — record", () => {
  it("freezes the versioned wording actually shown", () => {
    const st = attestationStatement("progress_note_sign");
    const rec = buildAttestationRecord({ statement: st, draft: drawn, signedBy: "Dr. A" });
    expect(rec.statementId).toBe("progress_note_sign");
    expect(rec.statementVersion).toBe(st.version);
    expect(rec.statementSnapshot).toBe(st.text);
    expect(rec.signatureDataUrl).toBe(drawn.signatureDataUrl);
    expect(rec.signatureStrokeCount).toBe(3);
    expect(rec.signedBy).toBe("Dr. A");
    expect(Date.parse(rec.signedAt)).not.toBeNaN();
  });

  it("names the trust model honestly and never claims verified identity", () => {
    const rec = buildAttestationRecord({
      statement: attestationStatement("progress_note_sign"),
      draft: drawn,
      signedBy: "Dr. A",
    });
    expect(rec.method).toBe("checkbox_and_drawn_mark");
  });

  it("refuses to build from an incomplete draft", () => {
    expect(() =>
      buildAttestationRecord({
        statement: attestationStatement("progress_note_sign"),
        draft: { attested: true },
        signedBy: "Dr. A",
      }),
    ).toThrow(/Draw your signature/i);
  });

  it("is not ProgressNote-specific — any consumer can register a statement", () => {
    const custom = {
      id: "provider_request_signoff",
      version: "v1",
      label: "Refill sign-off",
      text: "I attest that I reviewed this request.",
    };
    const rec = buildAttestationRecord({ statement: custom, draft: drawn, signedBy: "Dr. B" });
    expect(rec.statementId).toBe("provider_request_signoff");
    expect(rec.statementSnapshot).toBe(custom.text);
  });
});

describe("note consumer wiring", () => {
  it("gives a supervisor its own versioned wording", () => {
    expect(noteAttestationStatement(false).id).toBe("progress_note_sign");
    expect(noteAttestationStatement(true).id).toBe("progress_note_supervisor_sign");
    expect(ATTESTATION_STATEMENTS["progress_note_supervisor_sign"]!.text).toMatch(/supervising/i);
  });
});
