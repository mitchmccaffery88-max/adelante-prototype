// Drawn signature capture with anti-tap-fraud validation (§MAR Phase 3).
//
// Deliberately higher-rigor than KOP's typed acknowledgment: the Refusal
// document is a legal record, so the signature must be an actual drawn mark.
// A stroke set below either threshold (total path length / stroke count) is a
// tap or a dot and is rejected rather than saved.
import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Eraser, PenLine } from "lucide-react";
import {
  SIGNATURE_MIN_LENGTH,
  SIGNATURE_MIN_STROKES,
  isValidSignature,
  signatureMetrics,
  type SignatureMetrics,
} from "@/lib/refusal";
import { cn } from "@/lib/utils";

/**
 * Turns a rejected mark into an instruction rather than a verdict: say which
 * threshold missed and what to do about it, since "too short" alone reads as a
 * broken pad on a touchscreen where the first attempt is often a stray tap.
 */
function rejectionMessage(m: SignatureMetrics): string {
  const shortStrokes = m.strokeCount < SIGNATURE_MIN_STROKES;
  const shortLength = m.totalLength < SIGNATURE_MIN_LENGTH;
  if (m.strokeCount === 0) return "Nothing was drawn yet — sign in the box above.";
  if (shortStrokes && shortLength)
    return "That looks like a tap, not a signature. Write your full name in one continuous motion, lifting the pen at least once.";
  if (shortStrokes)
    return `Only one continuous stroke was recorded. Lift and set down the pen at least once (${SIGNATURE_MIN_STROKES} strokes minimum) — most signatures do this naturally.`;
  return "The mark is too small to read as a signature. Use more of the box and sign larger.";
}

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
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SignatureMetrics>({ totalLength: 0, strokeCount: 0 });
  const [width, setWidth] = useState(420);

  // Device-friendly sizing: the canvas has a fixed pixel buffer, so on a phone
  // or a narrow split-pane a 420px buffer stretched by CSS makes strokes land
  // off from the finger. Match the buffer to the rendered width instead.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const next = Math.max(240, Math.round(entry.contentRect.width));
      setWidth((prev) => (Math.abs(prev - next) > 8 ? next : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clear = useCallback(() => {
    ref.current?.clear();
    setError(null);
    setMetrics({ totalLength: 0, strokeCount: 0 });
    onChange(undefined);
  }, [onChange]);

  // Resizing the canvas element wipes its bitmap; drop any captured signature
  // so the record never keeps a mark the clinician can no longer see.
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const accept = () => {
    const pad = ref.current;
    if (!pad) return;
    const next = signatureMetrics(pad.toData() as { x: number; y: number }[][]);
    setMetrics(next);
    if (!isValidSignature(next)) {
      setError(rejectionMessage(next));
      onChange(undefined);
      return;
    }
    setError(null);
    onChange(pad.getCanvas().toDataURL("image/png"));
  };

  const lengthPct = Math.min(100, Math.round((metrics.totalLength / SIGNATURE_MIN_LENGTH) * 100));

  return (
    <div>
      <Label className="text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Draw your signature with a finger, stylus, or mouse — a single tap or dot is not accepted.
      </p>
      <div
        ref={boxRef}
        className={cn(
          "relative mt-1 rounded-md border bg-background",
          error
            ? "border-destructive"
            : value
              ? "border-emerald-500"
              : required
                ? "border-amber-500"
                : "border-border",
          disabled && "opacity-60",
        )}
      >
        {!value && metrics.strokeCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" />
            Sign here
          </div>
        )}
        <SignatureCanvas
          key={width}
          ref={(el) => {
            ref.current = el;
          }}
          penColor="currentColor"
          canvasProps={{
            width,
            height: 120,
            className: "w-full touch-none",
            "aria-label": label,
            role: "img",
          }}
          onEnd={accept}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={error ? "outline" : "ghost"}
          onClick={clear}
          disabled={disabled}
        >
          <Eraser className="h-3.5 w-3.5" />
          {error ? "Clear & try again" : "Clear"}
        </Button>
        <span aria-live="polite" className="text-xs">
          {value ? (
            <span className="text-emerald-700 dark:text-emerald-400">Signature captured</span>
          ) : error ? (
            <span className="text-destructive">Signature not accepted yet</span>
          ) : (
            <span className="text-muted-foreground">Sign in the box above</span>
          )}
        </span>
        {!value && metrics.strokeCount > 0 && (
          <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <Progress value={lengthPct} className="h-1 w-20" />
            {metrics.strokeCount}/{SIGNATURE_MIN_STROKES} strokes
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error} You can keep signing over the box, or clear it and start fresh.
        </p>
      )}
    </div>
  );
}
