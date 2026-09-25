// §Phase 10b — shared C-SSRS Screener form (staff-administered or patient
// self-report). Item wording is PLACEHOLDER until Columbia's official text is
// supplied and confirmed by clinical staff. Crisis help (988, "I need help
// now") stays visible around this form and is never gated by it.
import { useState } from "react";
import { AdelanteEHR } from "@/lib/ehr";
import {
  CSSRS_ITEMS,
  CSSRS_PLACEHOLDER_BANNER,
  CSSRS_RESPONSE_PROTOCOL,
  CSSRS_RISK_LABEL,
  CSSRS_TEXT_APPROVED,
  cssrsComplete,
  cssrsItemAsked,
  type CssrsAnswers,
  type CssrsRisk,
} from "@/lib/cssrs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CssrsForm({
  patientId,
  mode,
  staffName,
  staffRole,
  lang = "en",
  onDone,
}: {
  patientId: string;
  mode: "staff" | "patient_self";
  staffName?: string;
  staffRole?: string;
  lang?: "en" | "es";
  onDone?: (risk: CssrsRisk) => void;
}) {
  const [answers, setAnswers] = useState<CssrsAnswers>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CssrsRisk | null>(null);
  const es = lang === "es";

  if (done) {
    return (
      <div className="space-y-2 text-sm" data-testid="cssrs-done">
        {mode === "staff" ? (
          <>
            <div>
              Recorded · <Badge variant="outline">{CSSRS_RISK_LABEL[done]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Draft response protocol (pending clinical sign-off): {CSSRS_RESPONSE_PROTOCOL[done]}
            </p>
          </>
        ) : (
          <p>
            {es
              ? "Gracias. Tu equipo de atención verá tus respuestas. Si necesitas ayuda ahora, llama o envía un texto al 988."
              : "Thank you. Your care team will see your answers. If you need help now, call or text 988."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="cssrs-form">
      {!CSSRS_TEXT_APPROVED && (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground" data-testid="cssrs-placeholder">
          {CSSRS_PLACEHOLDER_BANNER}
        </p>
      )}
      {CSSRS_ITEMS.map((it, i) =>
        cssrsItemAsked(i, answers) ? (
          <fieldset key={it.n} className="space-y-1.5">
            <legend className="text-sm font-medium">{es ? it.es : it.en}</legend>
            <div className="flex gap-2">
              {([1, 0] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={answers[i] === v ? "default" : "outline"}
                  data-testid={`cssrs-q${i}-${v ? "yes" : "no"}`}
                  onClick={() => {
                    const next = [...answers];
                    next[i] = v;
                    setAnswers(next);
                  }}
                >
                  {v ? (es ? "Sí" : "Yes") : "No"}
                </Button>
              ))}
            </div>
          </fieldset>
        ) : null,
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        disabled={!cssrsComplete(answers)}
        data-testid="cssrs-submit"
        onClick={() => {
          try {
            const r = AdelanteEHR.recordCssrs({ patientId, answers, mode, staffName, staffRole });
            const risk = (r.cssrsRisk ?? "none") as CssrsRisk;
            setDone(risk);
            onDone?.(risk);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        {es ? "Enviar" : "Submit"}
      </Button>
    </div>
  );
}
