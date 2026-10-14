// §Patient portal Tier 1 Build B — the slip-support flow.
//
// Four steps, shame-free tone, and an explicit privacy promise that is TRUE in
// the code: the record is written to `selfTracking.ts`, a store with no
// cross-patient read, no audit sink and no EHR import, and imported by no
// staff surface. See the header of that module for the full argument.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { dayKeyLocal, daysSober, daysSoberLabel } from "@/lib/recoveryStartDate";
import { setRecoveryStartDate } from "@/lib/selfTracking";
import { useMyRecoveryStartDate } from "@/components/patient/RecoveryDateCard";
import {
  LAPSE_CONTRIBUTORS,
  LAPSE_HELPED_BEFORE,
  LAPSE_NEXT_STEPS,
  recordLapse,
  type LapseNextStepId,
} from "@/lib/selfTracking";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.4d726c8c4eee": {
    "en": "You came back. That's the part that counts.",
    "es": "Regresaste. Eso es lo que importa."
  },
  "ui.952f375412e8": {
    "en": "Start",
    "es": "Empezar"
  },
  "ui.ec486b11ec06": {
    "en": "What led up to it?",
    "es": "¿Qué pasó antes?"
  },
  "ui.fbab8c9eeba4": {
    "en": "Not a confession — you're looking for the pattern, same as anybody would.",
    "es": "No es una confesión: estás buscando un patrón, como cualquier otra persona."
  },
  "ui.bc981983e7f5": {
    "en": "Next",
    "es": "Siguiente"
  },
  "ui.427a8f21aa9d": {
    "en": "What's helped before?",
    "es": "¿Qué te ha ayudado antes?"
  },
  "ui.2a1124f5e1b6": {
    "en": "Things that have actually worked for you, not things that should work.",
    "es": "Cosas que realmente te han funcionado."
  },
  "ui.579a754dedbf": {
    "en": "One thing for the next 24 hours.",
    "es": "Una sola cosa para las próximas 24 horas."
  },
  "ui.532bdf94ce66": {
    "en": "One. Not a plan — a next move.",
    "es": "Uno. No un plan, sino un próximo paso."
  },
  "ui.b52b36b7269f": {
    "en": "Back",
    "es": "Atrás"
  },
  "ui.4ec71e380752": {
    "en": "Your recovery start date is up to you.",
    "es": "Tu fecha de inicio depende de ti."
  },
  "ui.962903b5ecbe": {
    "en": "It currently reads",
    "es": "Actualmente dice"
  },
  "ui.508822d22b78": {
    "en": "Keep my date",
    "es": "Mantener mi fecha"
  },
  "ui.4741ae8169bc": {
    "en": "Start the count from today",
    "es": "Empezar la cuenta desde hoy"
  },
  "ui.3da474537ac3": {
    "en": "Skip",
    "es": "Saltar"
  },
  "ui.d303044aa3ec": {
    "en": "If you're in danger right now,",
    "es": "Si estás en peligro ahora,"
  },
  "ui.d68a0c8f2230": {
    "en": "get help here",
    "es": "busca ayuda aquí"
  }
} as const;


/** Every option routes somewhere real — verified in `slipFlowDestinations`. */
export const NEXT_STEP_DESTINATIONS: Record<
  LapseNextStepId,
  { to: string; hash?: string; search?: Record<string, string> }
> = {
  message_care_team: { to: "/home", hash: "care-messages" },
  find_meeting: { to: "/resources" },
  craving_tool: { to: "/craving" },
  back_on_meds: { to: "/medications" },
  rest: { to: "/home" },
};

function Chips({
  options,
  value,
  onToggle,
  testPrefix,
}: {
  options: readonly { id: string; label: string }[];
  value: string[];
  onToggle: (id: string) => void;
  testPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            data-testid={`${testPrefix}-${o.id}`}
            onClick={() => onToggle(o.id)}
            className={`min-h-11 rounded-2xl border px-4 text-base ${
              on ? "border-primary bg-primary/10" : "bg-card hover:bg-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SlipSupportFlow() {
  const { lang: screenLang } = useI18n();

  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [contributors, setContributors] = useState<string[]>([]);
  const [helped, setHelped] = useState<string[]>([]);
  // §Recovery date — the OPTIONAL post-slip prompt. Nothing here changes the
  // date on its own: a slip is information, not a reset button. The prompt
  // only appears when a date is actually set, and "Keep my date" is a real,
  // equally-weighted answer.
  const recoveryDate = useMyRecoveryStartDate(patientId);
  const [pendingStep, setPendingStep] = useState<LapseNextStepId | null>(null);

  const toggle = (setter: typeof setContributors) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function finish(nextStep: LapseNextStepId) {
    recordLapse(patientId, { contributors, helpedBefore: helped, nextStep });
    toast.success("Saved. Just for you.");
    if (recoveryDate) {
      setPendingStep(nextStep);
      setStep(4);
      return;
    }
    goNext(nextStep);
  }

  function goNext(nextStep: LapseNextStepId) {
    const dest = NEXT_STEP_DESTINATIONS[nextStep];
    navigate({
      to: dest.to,
      ...(dest.hash ? { hash: dest.hash } : {}),
      ...(dest.search ? { search: dest.search } : {}),
    } as never);
  }

  return (
    <PatientPage data-testid="slip-flow">
      <PatientPageHeader
        icon={RotateCcw}
        title={<>{SCREEN_COPY["ui.4d726c8c4eee"][screenLang]}</>}
        lede="A slip is information, not a verdict. Four short screens, then one thing for the next 24 hours."
      >
        <p
          className="flex items-start gap-2 rounded-2xl bg-secondary p-3 text-sm"
          data-testid="slip-privacy-note"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          This stays with you. It is not in your chart, not visible to your care team, and not
          something your probation officer or the court can be shown from here.
        </p>
      </PatientPageHeader>

      {step === 0 && (
        <Card className="space-y-3 p-5" data-testid="slip-arrive">
          <p className="text-base">
            Nothing here gets reported. Nobody is notified. You can stop at any screen and what
            you&apos;ve picked so far is simply not saved.
          </p>
          <Button
            type="button"
            data-testid="slip-start"
            size="patient"
            className="w-full"
            onClick={() => setStep(1)}
          >
            {SCREEN_COPY["ui.952f375412e8"][screenLang]} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-3 p-5">
          <p className="text-base font-medium">{SCREEN_COPY["ui.ec486b11ec06"][screenLang]}</p>
          <p className="text-sm text-muted-foreground">
            {SCREEN_COPY["ui.fbab8c9eeba4"][screenLang]} </p>
          <Chips
            options={LAPSE_CONTRIBUTORS}
            value={contributors}
            onToggle={toggle(setContributors)}
            testPrefix="lapse-contrib"
          />
          <Button
            type="button"
            data-testid="slip-step1-next"
            size="patient"
            className="w-full"
            onClick={() => setStep(2)}
          >
            {SCREEN_COPY["ui.bc981983e7f5"][screenLang]} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-3 p-5">
          <p className="text-base font-medium">{SCREEN_COPY["ui.427a8f21aa9d"][screenLang]}</p>
          <p className="text-sm text-muted-foreground">
            {SCREEN_COPY["ui.2a1124f5e1b6"][screenLang]} </p>
          <Chips
            options={LAPSE_HELPED_BEFORE}
            value={helped}
            onToggle={toggle(setHelped)}
            testPrefix="lapse-helped"
          />
          <Button
            type="button"
            data-testid="slip-step2-next"
            size="patient"
            className="w-full"
            onClick={() => setStep(3)}
          >
            {SCREEN_COPY["ui.bc981983e7f5"][screenLang]} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-3 p-5">
          <p className="text-base font-medium">{SCREEN_COPY["ui.579a754dedbf"][screenLang]}</p>
          <p className="text-sm text-muted-foreground">{SCREEN_COPY["ui.532bdf94ce66"][screenLang]}</p>
          <div className="space-y-2">
            {LAPSE_NEXT_STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`lapse-next-${s.id}`}
                onClick={() => finish(s.id)}
                className="block w-full rounded-2xl border p-4 text-left hover:bg-secondary"
              >
                <span className="block text-base font-medium">{s.label}</span>
                <span className="block text-sm text-muted-foreground">{s.detail}</span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="patient"
            className="w-full"
            onClick={() => setStep(2)}
          >
            {SCREEN_COPY["ui.b52b36b7269f"][screenLang]} </Button>
        </Card>
      )}

      {step === 4 && pendingStep && (
        <Card className="space-y-3 p-5" data-testid="slip-date-prompt">
          <p className="text-base font-medium">{SCREEN_COPY["ui.4ec71e380752"][screenLang]}</p>
          <p className="text-sm text-muted-foreground">
            {SCREEN_COPY["ui.962903b5ecbe"][screenLang]} {daysSoberLabel(daysSober(recoveryDate))}. Some people restart the
            count after a slip, some don&apos;t — both are real recovery. Nothing changes unless
            you say so.
          </p>
          <p className="text-xs text-muted-foreground">
            Like this slip record, your recovery start date is yours alone — nobody else sees it.
          </p>
          <Button
            type="button"
            data-testid="slip-date-keep"
            size="patient"
            className="w-full"
            onClick={() => goNext(pendingStep)}
          >
            {SCREEN_COPY["ui.508822d22b78"][screenLang]} </Button>
          <Button
            type="button"
            variant="outline"
            size="patient"
            data-testid="slip-date-today"
            className="w-full"
            onClick={() => {
              setRecoveryStartDate(patientId, dayKeyLocal(new Date()));
              toast.success("Updated to today.");
              goNext(pendingStep);
            }}
          >
            {SCREEN_COPY["ui.4741ae8169bc"][screenLang]} </Button>
          <Button
            type="button"
            variant="ghost"
            size="patient"
            className="w-full"
            onClick={() => goNext(pendingStep)}
          >
            {SCREEN_COPY["ui.3da474537ac3"][screenLang]} </Button>
        </Card>
      )}

      <p className="px-1 text-sm text-muted-foreground">
        {SCREEN_COPY["ui.d303044aa3ec"][screenLang]} <Link to="/crisis" className="underline">{SCREEN_COPY["ui.d68a0c8f2230"][screenLang]}</Link>.
      </p>
    </PatientPage>
  );
}
