import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { SCREENERS, severityFor } from "@/lib/screeners";
import { HealthieService, useHealthie } from "@/lib/healthie";
import { toast } from "sonner";
import { ShieldCheck, Lock, CheckCircle2, Phone } from "lucide-react";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Intake & Screening — Adelante" },
      {
        name: "description",
        content:
          "Standardized screeners and needs assessment with built-in 42 CFR Part 2 consent.",
      },
    ],
  }),
  component: IntakePage,
});

type Mode = "self" | "assisted";

function IntakePage() {
  const navigate = useNavigate();
  const currentId = useHealthie(() => HealthieService.getCurrentPatientId());
  const patient = useHealthie(() => HealthieService.getPatient(currentId));
  const alreadyComplete = Boolean(patient?.intakeCompletedAt);
  const [mode, setMode] = useState<Mode>("self");
  const [step, setStep] = useState(0);
  const [sudConsent, setSudConsent] = useState<boolean | null>(null);
  const [hipaaConsent, setHipaaConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [needs, setNeeds] = useState({ housing: false, food: false, employment: false, transport: false });

  // Build step list: welcome, consent, screeners (filter SUD if no consent), needs, review
  const activeScreeners = useMemo(
    () => SCREENERS.filter((s) => !s.isSud || sudConsent === true),
    [sudConsent],
  );
  const steps = useMemo(
    () => [
      { key: "welcome", label: "Welcome" },
      { key: "consent", label: "Consent" },
      ...activeScreeners.map((s) => ({ key: s.key, label: s.name })),
      { key: "needs", label: "Needs" },
      { key: "review", label: "Review" },
    ],
    [activeScreeners],
  );
  const total = steps.length;
  const current = steps[Math.min(step, total - 1)];
  const pct = Math.round(((step + 1) / total) * 100);

  const next = () => setStep((s) => Math.min(s + 1, total - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = () => {
    activeScreeners.forEach((s) => {
      const ans = answers[s.key] ?? [];
      const score = ans.reduce((a, b) => a + (b ?? 0), 0);
      HealthieService.recordScreener(currentId, {
        key: s.key,
        score,
        severity: severityFor(s, score),
        completedAt: new Date().toISOString(),
      });
    });
    HealthieService.completeIntake(currentId, {
      needs,
      hipaa: hipaaConsent,
      part2Sud: sudConsent === true,
    });
    toast.success("Intake complete", {
      description: "Your care team will see this before your first session.",
    });
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      {alreadyComplete && (
        <Card className="mb-4 p-4 bg-teal/10 border-teal/30 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-teal mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-navy">You've already completed intake.</div>
            <div className="text-muted-foreground">
              You can update your answers below — your care team will be notified of any changes.
            </div>
          </div>
        </Card>
      )}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-teal">Intake & Screening</div>
            <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">{current.label}</h1>
          </div>
          <div className="flex rounded-full bg-secondary p-0.5 text-xs">
            <button
              onClick={() => setMode("self")}
              className={`px-3 py-1.5 rounded-full ${mode === "self" ? "bg-navy text-navy-foreground" : "text-foreground/60"}`}
            >
              Self
            </button>
            <button
              onClick={() => setMode("assisted")}
              className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${mode === "assisted" ? "bg-navy text-navy-foreground" : "text-foreground/60"}`}
            >
              <Phone className="h-3 w-3" /> Phone-assisted
            </button>
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="mt-1.5 text-xs text-muted-foreground">
          Step {step + 1} of {total}
        </div>
      </header>

      <Card className="p-6">
        {current.key === "welcome" && (
          <div className="space-y-4">
            <p className="text-foreground">
              Welcome. This intake takes about 10–15 minutes. There are no right
              or wrong answers — your honest responses help us plan care that
              fits your life right now.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-teal mt-0.5" /> You can pause and come back anytime.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-teal mt-0.5" /> A case manager can complete this with you by phone.</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-teal mt-0.5" /> Your information is private and protected by federal law.</li>
            </ul>
          </div>
        )}

        {current.key === "consent" && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-secondary/40 p-4">
              <div className="flex items-center gap-2 font-medium text-navy">
                <ShieldCheck className="h-4 w-4 text-teal" /> HIPAA — Notice of Privacy Practices
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Your protected health information is encrypted in transit and at rest. We share it only with people who help with your care.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={hipaaConsent} onCheckedChange={(v) => setHipaaConsent(Boolean(v))} />
                <span>I acknowledge the HIPAA Notice of Privacy Practices.</span>
              </label>
            </div>

            <div className="rounded-lg border-2 border-teal/30 bg-teal/5 p-4">
              <div className="flex items-center gap-2 font-medium text-navy">
                <Lock className="h-4 w-4 text-teal" /> 42 CFR Part 2 — Substance Use Records
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Federal law gives extra protection to information about alcohol
                or drug use. <strong className="text-foreground">Nothing about substance use is
                collected unless you agree.</strong> If you say no, your probation
                officer and other referrers will not receive any SUD details.
              </p>
              <RadioGroup
                className="mt-3 grid gap-2"
                value={sudConsent === null ? "" : sudConsent ? "yes" : "no"}
                onValueChange={(v) => setSudConsent(v === "yes")}
              >
                <label className="flex items-start gap-2 rounded-md border bg-card p-3 cursor-pointer">
                  <RadioGroupItem value="yes" />
                  <span className="text-sm">
                    <strong>Yes</strong> — I consent to share substance-use information with my Adelante care team.
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-md border bg-card p-3 cursor-pointer">
                  <RadioGroupItem value="no" />
                  <span className="text-sm">
                    <strong>No</strong> — Skip substance-use screening for now.
                  </span>
                </label>
              </RadioGroup>
            </div>
          </div>
        )}

        {activeScreeners.map(
          (s) =>
            current.key === s.key && (
              <div key={s.key} className="space-y-4">
                <div>
                  <Badge variant="outline" className="border-teal/40 text-teal">
                    {s.name}
                  </Badge>
                  {s.isSud && (
                    <Badge className="ml-2 bg-teal/15 text-teal border-0">42 CFR Part 2 protected</Badge>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                </div>
                <div className="space-y-5">
                  {s.questions.map((q, qi) => (
                    <div key={qi} className="rounded-lg border p-3">
                      <Label className="text-sm leading-snug">
                        {qi + 1}. {q}
                      </Label>
                      <RadioGroup
                        className="mt-2 flex flex-wrap gap-2"
                        value={String(answers[s.key]?.[qi] ?? "")}
                        onValueChange={(v) => {
                          const arr = [...(answers[s.key] ?? [])];
                          arr[qi] = Number(v);
                          setAnswers({ ...answers, [s.key]: arr });
                        }}
                      >
                        {s.options.map((o) => (
                          <label
                            key={o.value}
                            className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs cursor-pointer hover:border-teal"
                          >
                            <RadioGroupItem value={String(o.value)} />
                            {o.label}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </div>
            ),
        )}

        {current.key === "needs" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tell us what support you need right now. Select all that apply.
            </p>
            {([
              ["housing", "Stable housing"],
              ["food", "Food / CalFresh"],
              ["employment", "Employment / job training"],
              ["transport", "Transportation"],
            ] as const).map(([k, l]) => (
              <label
                key={k}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:border-teal"
              >
                <Checkbox
                  checked={needs[k]}
                  onCheckedChange={(v) => setNeeds({ ...needs, [k]: Boolean(v) })}
                />
                <span className="text-sm">{l}</span>
              </label>
            ))}
          </div>
        )}

        {current.key === "review" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review and submit. Your care team will use this to plan your first session.
            </p>
            <div className="rounded-lg border bg-secondary/30 p-4 space-y-2 text-sm">
              {activeScreeners.map((s) => {
                const ans = answers[s.key] ?? [];
                const score = ans.reduce((a, b) => a + (b ?? 0), 0);
                return (
                  <div key={s.key} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-medium text-navy">
                      {score} · {severityFor(s, score)}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2 border-t">
                <span>Needs flagged</span>
                <span className="font-medium text-navy">
                  {Object.values(needs).filter(Boolean).length} of 4
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-5 flex justify-between gap-3">
        <Button variant="outline" onClick={back} disabled={step === 0}>
          Back
        </Button>
        {step < total - 1 ? (
          <Button
            className="bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={next}
            disabled={current.key === "consent" && (!hipaaConsent || sudConsent === null)}
          >
            Continue
          </Button>
        ) : (
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90" onClick={submit}>
            Submit intake
          </Button>
        )}
      </div>
    </div>
  );
}