import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { SCREENERS, severityFor } from "@/lib/screeners";
import {
  AdelanteEHR,
  useEhr,
  type CoverageStatus,
  type ContactChannel,
  type BestTime,
  type PreferredLanguage,
} from "@/lib/ehr";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Phone,
  Heart,
  Save,
  Sparkles,
  CalendarCheck,
  HelpingHand,
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Intake & Screening — Adelante" },
      {
        name: "description",
        content: "Standardized screeners and needs assessment with built-in 42 CFR Part 2 consent.",
      },
    ],
  }),
  component: IntakePage,
});

function CoverageCallout({
  status,
  county,
  otherPlanName,
  onOtherPlanChange,
}: {
  status: CoverageStatus;
  county: string;
  otherPlanName: string;
  onOtherPlanChange: (v: string) => void;
}) {
  if (status === "active") {
    return (
      <div className="rounded-lg border-2 border-teal/40 bg-teal/5 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-teal mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-navy">You're all set.</div>
            <p className="text-muted-foreground mt-1">
              Your visits are free. We'll verify your Medi-Cal ID with
              {county ? ` ${county} County` : " the county"} — no action needed from you.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (status === "suspended") {
    return (
      <div className="rounded-lg border-2 border-gold/50 bg-gold/10 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-navy mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-navy">Your Medi-Cal turns back on automatically.</div>
            <p className="text-foreground/80 mt-1">
              Under CalAIM, your benefits reactivate when you come home — you don't need to reapply.
              A case manager will confirm with
              {county ? ` ${county} County` : " your county"} within 5 business days.
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (status === "none_unsure") {
    return (
      <div className="rounded-lg border-2 border-navy/30 bg-navy/5 p-4">
        <div className="flex items-start gap-3">
          <HelpingHand className="h-5 w-5 text-navy mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-navy">We'll help you apply.</div>
            <p className="text-muted-foreground mt-1">
              A case manager will start a BenefitsCal application with you. Most reentry adults
              qualify, and coverage is usually active within 10 days. Your visits stay free in the
              meantime.
            </p>
          </div>
        </div>
      </div>
    );
  }
  // "other"
  return (
    <div className="rounded-lg border bg-secondary/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Building2 className="h-5 w-5 text-navy mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-medium text-navy">We'll bill your plan.</div>
          <p className="text-muted-foreground mt-1">
            If your plan doesn't cover the visit, your sessions stay free through our reentry
            program — you will not get a bill.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Plan name (optional)</Label>
        <Input
          value={otherPlanName}
          onChange={(e) => onOtherPlanChange(e.target.value)}
          placeholder="e.g. Kaiser, Anthem Blue Cross"
        />
      </div>
    </div>
  );
}

type Mode = "self" | "assisted";

function IntakePage() {
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const alreadyComplete = Boolean(patient?.intakeCompletedAt);
  const [mode, setMode] = useState<Mode>("self");
  const [step, setStep] = useState(0);
  const [sudConsent, setSudConsent] = useState<boolean | null>(null);
  const [hipaaConsent, setHipaaConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [needs, setNeeds] = useState({
    housing: false,
    food: false,
    employment: false,
    transport: false,
  });
  const [coverage, setCoverage] = useState<{
    status: CoverageStatus;
    countyOfRelease: string;
    jiReentryFlag: boolean;
    otherPlanName?: string;
  }>({ status: "active", countyOfRelease: "Tulare", jiReentryFlag: false, otherPlanName: "" });
  // P1 — About you
  const [profile, setProfile] = useState({
    preferredName: "",
    pronouns: "",
    preferredLanguage: "en" as PreferredLanguage,
    phone: "",
    contactChannel: "text" as ContactChannel,
    bestTime: "morning" as BestTime,
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    address: "",
    releaseDate: "",
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Seed profile defaults from the patient row, once.
  useEffect(() => {
    if (!patient) return;
    setProfile((prev) => ({
      ...prev,
      preferredName: patient.preferredName ?? prev.preferredName,
      pronouns: patient.pronouns ?? prev.pronouns,
      preferredLanguage: patient.preferredLanguage ?? prev.preferredLanguage,
      phone: patient.phone || prev.phone,
      contactChannel: patient.contactPrefs?.channel ?? prev.contactChannel,
      bestTime: patient.contactPrefs?.bestTime ?? prev.bestTime,
      emergencyName: patient.emergencyContact?.name ?? prev.emergencyName,
      emergencyRelationship: patient.emergencyContact?.relationship ?? prev.emergencyRelationship,
      emergencyPhone: patient.emergencyContact?.phone ?? prev.emergencyPhone,
      address: patient.address ?? prev.address,
      releaseDate: patient.releaseDate || prev.releaseDate,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // P5 — save-and-resume to localStorage keyed by patient id.
  const storageKey = currentId ? `adelante.intake.${currentId}` : "";
  // Rehydrate on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.step != null) setStep(saved.step);
      if (saved.sudConsent !== undefined) setSudConsent(saved.sudConsent);
      if (saved.hipaaConsent != null) setHipaaConsent(saved.hipaaConsent);
      if (saved.answers) setAnswers(saved.answers);
      if (saved.needs) setNeeds(saved.needs);
      if (saved.coverage) setCoverage(saved.coverage);
      if (saved.profile) setProfile((p) => ({ ...p, ...saved.profile }));
      if (saved.savedAt) setSavedAt(saved.savedAt);
    } catch {
      /* no-op */
    }
  }, [storageKey]);
  // Persist on every meaningful change.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const at = new Date().toISOString();
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          step,
          sudConsent,
          hipaaConsent,
          answers,
          needs,
          coverage,
          profile,
          savedAt: at,
        }),
      );
      setSavedAt(at);
    } catch {
      /* no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sudConsent, hipaaConsent, answers, needs, coverage, profile]);

  // Crisis signal — PHQ-9 item 9 (self-harm thoughts) > 0
  const phqItem9 = answers["phq-9"]?.[8] ?? 0;
  const crisisFlagged = phqItem9 > 0;

  // Build step list: welcome, consent, screeners (filter SUD if no consent), needs, review
  const activeScreeners = useMemo(
    () => SCREENERS.filter((s) => !s.isSud || sudConsent === true),
    [sudConsent],
  );
  const steps = useMemo(
    () => [
      { key: "welcome", label: "Welcome" },
      { key: "about", label: "About you" },
      { key: "consent", label: "Consent" },
      { key: "coverage", label: "Medi-Cal" },
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
    // P1 — persist the About-you patch first.
    AdelanteEHR.updateProfile(currentId, {
      preferredName: profile.preferredName || undefined,
      pronouns: profile.pronouns || undefined,
      preferredLanguage: profile.preferredLanguage,
      phone: profile.phone || undefined,
      releaseDate: profile.releaseDate || undefined,
      contactPrefs: { channel: profile.contactChannel, bestTime: profile.bestTime },
      emergencyContact: profile.emergencyName
        ? {
            name: profile.emergencyName,
            relationship: profile.emergencyRelationship,
            phone: profile.emergencyPhone,
          }
        : undefined,
      address: profile.address || undefined,
    });
    activeScreeners.forEach((s) => {
      const ans = answers[s.key] ?? [];
      const score = ans.reduce((a, b) => a + (b ?? 0), 0);
      const isPhq = s.key === "phq-9";
      const itemFlag = isPhq && (ans[8] ?? 0) > 0;
      AdelanteEHR.recordScreener(currentId, {
        key: s.key,
        score,
        severity: severityFor(s, score),
        completedAt: new Date().toISOString(),
        timepoint: "intake",
        crisisFlag: itemFlag,
      });
    });
    AdelanteEHR.setCoverage(currentId, {
      status: coverage.status,
      verified:
        coverage.status === "active"
          ? "verified"
          : coverage.status === "suspended"
            ? "pending"
            : "not_found",
      countyOfRelease: coverage.countyOfRelease,
      jiReentryFlag: coverage.jiReentryFlag,
      otherPlanName: coverage.status === "other" ? coverage.otherPlanName : undefined,
    });
    AdelanteEHR.completeIntake(currentId, {
      needs,
      hipaa: hipaaConsent,
      part2Sud: sudConsent === true,
    });
    if (crisisFlagged) {
      AdelanteEHR.raiseCrisisFlag(currentId, "phq-9-item-9");
    }
    toast.success("Intake complete", {
      description: "Your care team will see this before your first session.",
    });
    try {
      if (storageKey) localStorage.removeItem(storageKey);
    } catch {
      /* no-op */
    }
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      {crisisFlagged && (
        <Card className="mb-4 p-4 border-2 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-destructive">
                It sounds like things are really hard right now.
              </div>
              <p className="text-foreground/80 mt-1">
                You're not alone — and help is here. Please call or text{" "}
                <a href="tel:988" className="underline font-semibold">
                  988
                </a>{" "}
                anytime to talk to someone. Your care team has also been notified.
              </p>
              <Button
                asChild
                className="mt-3 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <a href="tel:988">
                  <Phone className="h-4 w-4 mr-1.5" /> Talk to someone now
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}
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
      <header className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-teal">
              Intake & Screening
            </div>
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
        {/* §Crisis-flag stopgap — always visible in the sticky intake header,
            at every step, so a helper never has to navigate away. Renders only
            for staff roles allowed to flag. */}
        <div className="flex justify-end mb-2">
          <AssistedSignupCrisisButton patientId={currentId} />
        </div>
        <Progress value={pct} className="h-2" />
        <div className="mt-1.5 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Step {step + 1} of {total}
          </span>
          {savedAt && (
            <span className="inline-flex items-center gap-1 text-teal">
              <Save className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </header>

      <Card className="p-6">
        {current.key === "welcome" && (
          <div className="space-y-4">
            <p className="text-foreground">
              Welcome. This intake takes about 10–15 minutes. There are no right or wrong answers —
              your honest responses help us plan care that fits your life right now.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal mt-0.5" /> You can pause and come back
                anytime.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal mt-0.5" /> A case manager can complete
                this with you by phone.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal mt-0.5" /> Your information is private
                and protected by federal law.
              </li>
            </ul>
          </div>
        )}

        {current.key === "about" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              A few quick details so we can reach you the right way. You can skip anything you're
              not ready to share.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Preferred name</Label>
                <Input
                  value={profile.preferredName}
                  onChange={(e) => setProfile({ ...profile, preferredName: e.target.value })}
                  placeholder="What should we call you?"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Pronouns (optional)</Label>
                <Input
                  value={profile.pronouns}
                  onChange={(e) => setProfile({ ...profile, pronouns: e.target.value })}
                  placeholder="she/her, he/him, they/them…"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Preferred language</Label>
                <Select
                  value={profile.preferredLanguage}
                  onValueChange={(v) =>
                    setProfile({ ...profile, preferredLanguage: v as PreferredLanguage })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Phone</Label>
                <Input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+1 555 555 0123"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Best way to reach you</Label>
                <Select
                  value={profile.contactChannel}
                  onValueChange={(v) =>
                    setProfile({ ...profile, contactChannel: v as ContactChannel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="call">Phone call</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Best time to reach you</Label>
                <Select
                  value={profile.bestTime}
                  onValueChange={(v) => setProfile({ ...profile, bestTime: v as BestTime })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm">Release date (if applicable)</Label>
                <Input
                  type="date"
                  value={profile.releaseDate ? profile.releaseDate.slice(0, 10) : ""}
                  onChange={(e) => setProfile({ ...profile, releaseDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm">Mailing or temporary address</Label>
                <Input
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Street, city, state, zip"
                />
              </div>
            </div>
            <div className="rounded-lg border bg-secondary/40 p-4 space-y-3">
              <div className="text-sm font-medium text-navy">Emergency contact</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Name"
                  value={profile.emergencyName}
                  onChange={(e) => setProfile({ ...profile, emergencyName: e.target.value })}
                />
                <Input
                  placeholder="Relationship"
                  value={profile.emergencyRelationship}
                  onChange={(e) =>
                    setProfile({ ...profile, emergencyRelationship: e.target.value })
                  }
                />
                <Input
                  type="tel"
                  placeholder="Phone"
                  value={profile.emergencyPhone}
                  onChange={(e) => setProfile({ ...profile, emergencyPhone: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {current.key === "coverage" && (
          <div className="space-y-5">
            <div>
              <Badge variant="outline" className="border-teal/40 text-teal">
                Medi-Cal
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Adelante visits are free with Medi-Cal. If your Medi-Cal was paused while you were
                away, it turns back on when you come home — you don't have to reapply. We can help.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">County of release</Label>
              <input
                value={coverage.countyOfRelease}
                onChange={(e) => setCoverage({ ...coverage, countyOfRelease: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Do you have Medi-Cal?</Label>
              <Select
                value={coverage.status}
                onValueChange={(v) => setCoverage({ ...coverage, status: v as CoverageStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Yes — it's active</SelectItem>
                  <SelectItem value="suspended">It was paused while I was away</SelectItem>
                  <SelectItem value="none_unsure">No / I'm not sure</SelectItem>
                  <SelectItem value="other">I have other coverage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CoverageCallout
              status={coverage.status}
              county={coverage.countyOfRelease}
              otherPlanName={coverage.otherPlanName ?? ""}
              onOtherPlanChange={(v) => setCoverage({ ...coverage, otherPlanName: v })}
            />
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border bg-secondary/40 p-3">
              <Checkbox
                checked={coverage.jiReentryFlag}
                onCheckedChange={(v) => setCoverage({ ...coverage, jiReentryFlag: Boolean(v) })}
              />
              <span>
                I'm coming home within the next 90 days (Justice-Involved Reentry Initiative —
                unlocks pre-release coordination).
              </span>
            </label>
          </div>
        )}

        {current.key === "consent" && (
          <div className="space-y-5">
            <div className="rounded-lg border bg-secondary/40 p-4">
              <div className="flex items-center gap-2 font-medium text-navy">
                <ShieldCheck className="h-4 w-4 text-teal" /> HIPAA — Notice of Privacy Practices
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Your protected health information is encrypted in transit and at rest. We share it
                only with people who help with your care.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={hipaaConsent}
                  onCheckedChange={(v) => setHipaaConsent(Boolean(v))}
                />
                <span>I acknowledge the HIPAA Notice of Privacy Practices.</span>
              </label>
            </div>

            <div className="rounded-lg border-2 border-teal/30 bg-teal/5 p-4">
              <div className="flex items-center gap-2 font-medium text-navy">
                <Lock className="h-4 w-4 text-teal" /> 42 CFR Part 2 — Substance Use Records
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Federal law gives extra protection to information about alcohol or drug use.{" "}
                <strong className="text-foreground">
                  Nothing about substance use is collected unless you agree.
                </strong>{" "}
                If you say no, your probation officer and other referrers will not receive any SUD
                details.
              </p>
              <RadioGroup
                className="mt-3 grid gap-2"
                value={sudConsent === null ? "" : sudConsent ? "yes" : "no"}
                onValueChange={(v) => setSudConsent(v === "yes")}
              >
                <label className="flex items-start min-h-11 gap-2 rounded-md border bg-card py-3 px-3 cursor-pointer">
                  <RadioGroupItem value="yes" />
                  <span className="text-sm">
                    <strong>Yes</strong> — I consent to share substance-use information with my
                    Adelante care team.
                  </span>
                </label>
                <label className="flex items-start min-h-11 gap-2 rounded-md border bg-card py-3 px-3 cursor-pointer">
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
                    <Badge className="ml-2 bg-teal/15 text-teal border-0">
                      42 CFR Part 2 protected
                    </Badge>
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
                            className="flex items-center min-h-11 gap-1.5 rounded-full border bg-card px-3 py-2.5 text-xs cursor-pointer hover:border-teal"
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
            {(
              [
                ["housing", "Stable housing"],
                ["food", "Food / CalFresh"],
                ["employment", "Employment / job training"],
                ["transport", "Transportation"],
              ] as const
            ).map(([k, l]) => (
              <label
                key={k}
                className="flex items-center min-h-11 gap-3 rounded-lg border py-3 px-3 cursor-pointer hover:border-teal"
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

      {/* Spacer so the fixed mobile action bar doesn't cover content */}
      <div className="h-20 sm:hidden" aria-hidden />
      <div className="fixed sm:sticky bottom-0 left-0 right-0 sm:left-auto sm:right-auto z-30 mt-5 flex justify-between gap-3 bg-background/95 backdrop-blur border-t sm:border-0 sm:bg-transparent px-4 sm:px-0 py-3 sm:py-0">
        <Button variant="outline" className="min-h-11" onClick={back} disabled={step === 0}>
          Back
        </Button>
        {step < total - 1 ? (
          <Button
            className="min-h-11 bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={next}
            disabled={current.key === "consent" && (!hipaaConsent || sudConsent === null)}
          >
            Save &amp; continue
          </Button>
        ) : (
          <Button
            className="min-h-11 bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={submit}
          >
            Submit intake
          </Button>
        )}
      </div>
    </div>
  );
}
