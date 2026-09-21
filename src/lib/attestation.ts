// §EHR audit Phase 1d — a REUSABLE attestation + signature-capture primitive.
//
// WHAT THIS IS
// ------------
// A domain-agnostic way to turn "a person attested to a statement and drew a
// mark" into a persisted record. It knows nothing about ProgressNote,
// RefusalForm, provider requests, or any other consumer: the only inputs are a
// versioned statement, a draft (checkbox + drawn mark), and a signer label.
// Consumers own their own authorization (e.g. `noteSignAuthorization`) and
// their own domain blockers, then merge them with `mergeBlockers` for display.
//
// HONESTY ABOUT TRUST
// -------------------
// This does NOT raise identity assurance. There is no staff authentication in
// this app, no re-credentialing prompt, and no device/session capture. What is
// captured is CEREMONY AND EVIDENCE — a checkbox against wording we can prove
// was on screen, plus a drawn mark validated as a real signature rather than a
// stray tap. `method: "checkbox_and_drawn_mark"` names that honestly, the same
// way `RefusalForm.attestationMethod: "checkbox_only"` does. No UI copy built
// on this may imply a verified identity.
//
// VERSIONED WORDING
// -----------------
// Following the `riskTextVersion` / `riskTextSnapshot` pattern on RefusalForm:
// the record freezes the exact wording shown, so editing a statement later can
// never rewrite what somebody actually attested to.

import { isValidSignature, signatureMetrics, type SignatureMetrics } from "@/lib/refusal";

/** How identity was (not) established. Deliberately narrow and honest. */
export type AttestationMethod = "checkbox_and_drawn_mark";

export interface AttestationStatement {
  /** Stable identity across versions, e.g. "progress_note_sign". */
  id: string;
  /** Bumped whenever `text` changes. Frozen onto every record. */
  version: string;
  /** Short label for the surface presenting it. */
  label: string;
  /** The wording the signer actually reads. */
  text: string;
}

/** What a consumer's UI collects before a record can be built. */
export interface AttestationDraft {
  attested: boolean;
  /** PNG data URL from `SignaturePad`. */
  signatureDataUrl?: string;
  /** Stroke metrics, when the capture surface reports them. */
  metrics?: SignatureMetrics;
}

export const emptyAttestationDraft = (): AttestationDraft => ({ attested: false });

/** The persisted artifact. Consumers store this verbatim on their own row. */
export interface AttestationRecord {
  statementId: string;
  statementVersion: string;
  /** Frozen copy of the wording attested to — never re-resolved on read. */
  statementSnapshot: string;
  attested: true;
  /** The drawn mark, as captured. */
  signatureDataUrl: string;
  /** Anti-tap-fraud evidence, when the capture surface reported it. */
  signatureStrokeCount?: number;
  signatureLength?: number;
  /** Display name of the person who clicked. Not a verified identity. */
  signedBy: string;
  signedAt: string;
  method: AttestationMethod;
}

// ---------------------------------------------------------------------------
// Blockers — the `refusalFinalizeProblems()` pattern, generalized.
// ---------------------------------------------------------------------------

export interface SignBlocker {
  /** Machine code, for tests and telemetry. */
  code: string;
  /** One sentence, in the signer's words, saying what to do. */
  message: string;
}

/** Everything the attestation layer itself is blocking on, in display order. */
export function attestationBlockers(draft: AttestationDraft): SignBlocker[] {
  const out: SignBlocker[] = [];
  if (!draft.attested)
    out.push({ code: "attestation_unchecked", message: "Confirm the attestation statement." });
  if (!draft.signatureDataUrl)
    out.push({ code: "signature_missing", message: "Draw your signature in the box." });
  else if (draft.metrics && !isValidSignature(draft.metrics))
    out.push({
      code: "signature_invalid",
      message: "The mark captured is too small to read as a signature — sign again, larger.",
    });
  return out;
}

/**
 * Merge domain blockers with attestation blockers into one ordered list.
 * Domain problems come first: fixing the documentation matters before the
 * ceremony at the bottom of the form. Duplicate codes collapse.
 */
export function mergeBlockers(...lists: (SignBlocker[] | undefined)[]): SignBlocker[] {
  const seen = new Set<string>();
  const out: SignBlocker[] = [];
  for (const list of lists) {
    for (const b of list ?? []) {
      if (seen.has(b.code)) continue;
      seen.add(b.code);
      out.push(b);
    }
  }
  return out;
}

export function canBuildAttestation(draft: AttestationDraft): boolean {
  return attestationBlockers(draft).length === 0;
}

/**
 * Build the persisted record. Throws on the first blocker, so a consumer can
 * never persist a half-captured attestation even if its UI let the click
 * through.
 */
export function buildAttestationRecord(input: {
  statement: AttestationStatement;
  draft: AttestationDraft;
  signedBy: string;
  now?: Date;
}): AttestationRecord {
  const problems = attestationBlockers(input.draft);
  if (problems.length) throw new Error(problems[0].message);
  const signer = input.signedBy.trim();
  if (!signer) throw new Error("A signer name is required.");
  const m = input.draft.metrics;
  return {
    statementId: input.statement.id,
    statementVersion: input.statement.version,
    statementSnapshot: input.statement.text,
    attested: true,
    signatureDataUrl: input.draft.signatureDataUrl as string,
    ...(m ? { signatureStrokeCount: m.strokeCount, signatureLength: m.totalLength } : {}),
    signedBy: signer,
    signedAt: (input.now ?? new Date()).toISOString(),
    method: "checkbox_and_drawn_mark",
  };
}

/** Metrics helper re-exported so consumers don't reach into the refusal module. */
export function metricsFromStrokes(
  strokes: { x: number; y: number }[][] | undefined,
): SignatureMetrics {
  return signatureMetrics(strokes);
}

/**
 * The single line every capture surface shows under the pad. States exactly
 * what the record is worth — no more.
 */
export const ATTESTATION_TRUST_NOTE =
  "This records your attestation and the mark you drew. It does not verify your identity — Adelante has no staff sign-in yet.";

// ---------------------------------------------------------------------------
// Statement catalog. Versioned like the refusal risk text: edit the text, bump
// the version. Records already written keep their own frozen snapshot.
// ---------------------------------------------------------------------------

export const ATTESTATION_STATEMENTS: Record<string, AttestationStatement> = {
  progress_note_sign: {
    id: "progress_note_sign",
    version: "v1",
    label: "Progress note signature",
    text: "I attest that this note is accurate, complete, and reflects care I personally provided or supervised.",
  },
  progress_note_supervisor_sign: {
    id: "progress_note_supervisor_sign",
    version: "v1",
    label: "Supervisor signature",
    text: "I attest, as the supervising clinician of record, that I have reviewed this note in full and that signing it reflects my own clinical judgment.",
  },
};

export function attestationStatement(id: string): AttestationStatement {
  const s = ATTESTATION_STATEMENTS[id];
  if (!s) throw new Error(`Unknown attestation statement: ${id}`);
  return s;
}
