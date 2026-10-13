import type { HTMLAttributes } from "react";
import { Check, CircleAlert, Clock, CircleDashed, ShieldAlert, CircleMinus, Lock, FlaskConical, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type StatusChipState = "done" | "yourturn" | "team" | "upnext" | "urgent" | "closed" | "restricted" | "simulated";
const states = {
  done: { icon: Check, color: "border-done bg-path-soft text-done", en: "Done", es: "Hecho" },
  yourturn: { icon: CircleAlert, color: "border-attention bg-attention-soft text-on-attention-soft", en: "Your turn", es: "Tu turno" },
  team: { icon: Clock, color: "border-info bg-info-soft text-info", en: "With others", es: "Con otros" },
  upnext: { icon: CircleDashed, color: "border-line-strong border-dashed bg-surface text-ink-muted", en: "Up next", es: "Próximo" },
  urgent: { icon: ShieldAlert, color: "border-urgent bg-urgent-soft text-urgent", en: "Urgent", es: "Urgente" },
  closed: { icon: CircleMinus, color: "border-line-strong bg-surface-sunk text-ink-muted", en: "Closed", es: "Cerrado" },
  restricted: { icon: Lock, color: "border-line-strong bg-restricted-soft text-restricted", en: "Restricted", es: "Restringido" },
  simulated: { icon: FlaskConical, color: "border-path bg-path-faint text-path", en: "Simulated", es: "Simulado" },
} as const;

/** Presentation only: state and waiting time always come from the caller's real record. */
export function StatusChip({ state, aiDraft = false, waitingDays, lang: providedLang, className, ...props }: HTMLAttributes<HTMLSpanElement> & { state: StatusChipState; aiDraft?: boolean; waitingDays?: number; lang?: "en" | "es" }) {
  const { lang } = useI18n();
  const es = (providedLang ?? lang) === "es";
  const item = states[state];
  const Icon = item.icon;
  const word = es ? item.es : item.en;
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle">
    <span {...props} data-status={state} aria-label={word} className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-sm font-medium leading-5", item.color, className)}>
      <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" /><span>{word}</span>
    </span>
    {aiDraft && <span className="inline-flex items-center gap-1 text-sm text-ink-muted"><Sparkles className="size-4" aria-hidden="true" />{es ? "Borrador de IA" : "AI draft"}</span>}
    {waitingDays !== undefined && Number.isFinite(waitingDays) && waitingDays >= 0 && <span className="text-sm text-ink-muted">{es ? `En espera ${Math.floor(waitingDays)} días` : `Waiting ${Math.floor(waitingDays)} days`}</span>}
    {es && <span className="text-sm text-ink-muted">Borrador — pendiente de revisión de traducción</span>}
  </span>;
}