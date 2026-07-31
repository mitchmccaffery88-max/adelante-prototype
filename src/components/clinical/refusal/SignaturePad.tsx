// Drawn signature capture with anti-tap-fraud validation (§MAR Phase 3).
//
// Deliberately higher-rigor than KOP's typed acknowledgment: the Refusal
// document is a legal record, so the signature must be an actual drawn mark.
// A stroke set below either threshold (total path length / stroke count) is a
// tap or a dot and is rejected rather than saved.
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SIGNATURE_MIN_LENGTH,
  SIGNATURE_MIN_STROKES,
  isValidSignature,
  signatureMetrics,
} from "@/lib/refusal";
import { cn } from "@/lib/utils";

export function SignaturePad({
  label,
  required,
  value,
  onChange,
  disabled,
}: {
  label: string;
  required?: boolean;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  disabled?: boolean;
}) {
  const ref = useRef<SignatureCanvas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    ref.current?.clear();
    setError(null);
    onChange(undefined);
  };

  const accept = () => {
    const pad = ref.current;
    if (!pad) return;
    const metrics = signatureMetrics(pad.toData() as { x: number; y: number }[][]);
    if (!isValidSignature(metrics)) {
      setError(
        `That mark is too short to be a signature (needs at least ${SIGNATURE_MIN_STROKES} strokes and ${SIGNATURE_MIN_LENGTH}px of movement). Please sign again.`,
      );
      onChange(undefined);
      return;
    }
    setError(null);
    onChange(pad.getCanvas().toDataURL("image/png"));
  };

  return (
    <div>
      <Label className="text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      <div
        className={cn(
          "mt-1 rounded-md border bg-background",
          value ? "border-emerald-500" : required ? "border-amber-500" : "border-border",
          disabled && "opacity-60",
        )}
      >
        <SignatureCanvas
          ref={(el) => {
            ref.current = el;
          }}
          penColor="currentColor"
          canvasProps={{
            width: 420,
            height: 120,
            className: "w-full touch-none",
            "aria-label": label,
            role: "img",
          }}
          onEnd={accept}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={disabled}>
          Clear
        </Button>
        {value ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">Signature captured</span>
        ) : (
          <span className="text-xs text-muted-foreground">Sign in the box above</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
