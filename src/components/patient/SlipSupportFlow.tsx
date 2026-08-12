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
import {
  LAPSE_CONTRIBUTORS,
  LAPSE_HELPED_BEFORE,
  LAPSE_NEXT_STEPS,
  recordLapse,
  type LapseNextStepId,
} from "@/lib/selfTracking";

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
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [contributors, setContributors] = useState<string[]>([]);
  const [helped, setHelped] = useState<string[]>([]);

  const toggle = (setter: typeof setContributors) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function finish(nextStep: LapseNextStepId) {
    recordLapse(patientId, { contributors, helpedBefore: helped, nextStep });
    toast.success("Saved. Just for you.");
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
        title={<>You came back. That&apos;s the part that counts.</>}
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
            Start <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-3 p-5">
          <p className="text-base font-medium">What led up to it?</p>
          <p className="text-sm text-muted-foreground">
            Not a confession — you&apos;re looking for the pattern, same as anybody would.
          </p>
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
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-3 p-5">
          <p className="text-base font-medium">What&apos;s helped before?</p>
          <p className="text-sm text-muted-foreground">
            Things that have actually worked for you, not things that should work.
          </p>
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
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-3 p-5">
          <p className="text-base font-medium">One thing for the next 24 hours.</p>
          <p className="text-sm text-muted-foreground">One. Not a plan — a next move.</p>
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
            Back
          </Button>
        </Card>
      )}

      <p className="px-1 text-sm text-muted-foreground">
        If you&apos;re in danger right now, <Link to="/crisis" className="underline">get help here</Link>.
      </p>
    </PatientPage>
  );
}
