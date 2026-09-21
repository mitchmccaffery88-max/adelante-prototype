// jsdom has no canvas 2D context, so `react-signature-canvas` throws on mount.
// Component tests that render a chart surface containing the signing panel use
// this stub via `vi.mock("@/components/clinical/refusal/SignaturePad", ...)`.
// Signature validation itself is covered by real unit tests against
// `signatureMetrics`/`isValidSignature` and `attestationBlockers`.
export function SignaturePad({ label }: { label: string; [k: string]: unknown }) {
  return <div data-testid="signature-pad-stub" aria-label={label} />;
}
