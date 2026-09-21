// §EHR audit Phase 1d — the reusable capture surface for the attestation
// primitive in `src/lib/attestation.ts`.
//
// Consumer-agnostic on purpose: it takes a versioned statement and a draft,
// and hands back a new draft. It knows nothing about notes, refusals, or
// provider requests. Authorization and domain blockers stay with the consumer.
//
// The drawn-mark capture is the EXISTING `SignaturePad` — same anti-tap-fraud
// thresholds as the refusal document, not a second implementation.
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/clinical/refusal/SignaturePad";
import {
  ATTESTATION_TRUST_NOTE,
  type AttestationDraft,
  type AttestationStatement,
} from "@/lib/attestation";

export function AttestationSignatureBlock({
  statement,
  draft,
  onChange,
  disabled,
  signatureLabel = "Your signature",
}: {
  statement: AttestationStatement;
  draft: AttestationDraft;
  onChange: (next: AttestationDraft) => void;
  disabled?: boolean;
  signatureLabel?: string;
}) {
  return (
    <div className="space-y-2" data-testid="attestation-signature-block">
      <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Checkbox
          checked={draft.attested}
          onCheckedChange={(v) => onChange({ ...draft, attested: Boolean(v) })}
          aria-label="Attestation"
          disabled={disabled}
        />
        <span data-testid="attestation-statement-text">{statement.text}</span>
      </label>
      <SignaturePad
        label={signatureLabel}
        required
        {...(draft.signatureDataUrl ? { value: draft.signatureDataUrl } : {})}
        onChange={(dataUrl) =>
          onChange({
            ...draft,
            ...(dataUrl ? { signatureDataUrl: dataUrl } : { signatureDataUrl: undefined }),
          })
        }
        {...(disabled ? { disabled } : {})}
      />
      <p className="text-[10px] text-muted-foreground" data-testid="attestation-trust-note">
        {ATTESTATION_TRUST_NOTE} Wording version {statement.version}.
      </p>
    </div>
  );
}
