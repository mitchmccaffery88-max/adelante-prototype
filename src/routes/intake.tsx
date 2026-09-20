import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { AssistedSignupCrisisButton } from "@/components/clinical/AssistedSignupCrisisButton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { SCREENERS, severityFor } from "@/lib/screeners";
import {
  AdelanteEHR,
  SDOH_SOURCE_LABEL,
  useEhr,
  type CoverageStatus,
  type ContactChannel,
  type BestTime,
  type PreferredLanguage,
} from "@/lib/ehr";
// §Intake/SDOH Redesign Phase 3 — reconcile against real prior SDOH data.
import { buildIntakeNeedsPlan } from "@/lib/intakeNeedsReconcile";
import { INTAKE_NEED_LABEL, type IntakeNeedKey } from "@/lib/sdohMapping";
import {
  cleanEmergencyContacts,
  emptyEmergencyContact,
} from "@/lib/emergencyContacts";
import {
  mergeSavedIntakeProfile,
  seedIntakeProfile,
  type IntakeProfile,
} from "@/lib/intakeProfile";
import { Input } from "@/components/ui/input";
import {
  COVERAGE_TYPES,
  HEARD_ABOUT_SOURCES,
  coverageMessage,
  ecmQuestionApplies,
  shouldAskHeardAbout,
  type CoverageType,
  type HeardAboutSource,
  type TriState,
} from "@/lib/frontDoor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// §Reporting Tier 2 — structured CalOMS-shaped history captured at intake.
import {
  CALOMS_FREQUENCIES,
  CALOMS_ROUTES,
  CALOMS_SUBSTANCES,
  FREQUENCY_LABEL,
  JUSTICE_REFERRAL_LABEL,
  JUSTICE_REFERRAL_SOURCES,
  JUSTICE_SELF_REPORT_NOTE,
  PRIOR_EPISODE_BUCKETS,
  PRIOR_EPISODE_LABEL,
  PRIOR_TREATMENT_TYPES,
  PRIOR_TREATMENT_TYPE_LABEL,
  ROUTE_LABEL,
  SUBSTANCE_LABEL,
  type CalomsFrequency,
  type CalomsRoute,
  type CalomsSubstance,
  type JusticeReferralSource,
  type PriorEpisodeBucket,
  type PriorTreatmentType,
} from "@/lib/caloms";
import { hasExistingHistory, seedIntakeHistory, type IntakeHistory } from "@/lib/intakeHistory";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useActingStaff } from "@/lib/roles";
import {
  LOOKUP_DISCLOSURE,
  MEDI_CAL_FOLLOW_UP_MESSAGE,
  shouldRunSafetyNetLookup,
  type LookupResult,
} from "@/lib/missedHandoff";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Phone,
  Heart,
  Save,
  Sparkles,
  Search,
  CalendarCheck,
  HelpingHand,
  Building2,
  Plus,
  Trash2,
  Languages,
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

/**
 * Coverage messaging. All wording now comes from `coverageMessage`, which keys
 * the reentry safety-net promise off justice involvement rather than coverage
 * type — the old "other coverage" branch told private-pay patients with no
 * justice history that their sessions were free, which was not true.
 */
function CoverageCallout({
  coverageType,
  justiceInvolvement,
  county,
  otherPlanName,
  onOtherPlanChange,
}: {
  coverageType: CoverageType;
  justiceInvolvement: TriState;
  county: string;
  otherPlanName: string;
  onOtherPlanChange: (v: string) => void;
}) {
  const msg = coverageMessage({ coverageType, justiceInvolvement, county });
  const Icon = msg.tone === "good" ? CheckCircle2 : msg.tone === "info" ? Building2 : HelpingHand;
  const shell =
    msg.tone === "good"
      ? "border-2 border-teal/40 bg-teal/5"
      : msg.tone === "action"
        ? "border-2 border-navy/30 bg-navy/5"
        : "border bg-secondary/40";

  return (
    <div className={`rounded-lg p-4 space-y-3 ${shell}`} data-testid="coverage-callout">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-navy mt-0.5 shrink-0" />
        <div className="text-sm">
          <div className="font-medium text-navy">{msg.title}</div>
          <p className="text-muted-foreground mt-1">{msg.body}</p>
          {msg.billingNote && (
            <p className="mt-2 text-foreground/80" data-testid="billing-note">
              {msg.billingNote}
            </p>
          )}
          {msg.reentrySafetyNet && (
            <p className="mt-2 flex items-start gap-2 text-foreground/80" data-testid="reentry-note">
              <Sparkles className="h-4 w-4 shrink-0 text-navy mt-0.5" />
              <span>{msg.reentrySafetyNet}</span>
            </p>
          )}
        </div>
      </div>
      {(coverageType === "private" || coverageType === "medicare") && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Plan name (optional)</Label>
          <Input
            value={otherPlanName}
            onChange={(e) => onOtherPlanChange(e.target.value)}
            placeholder="e.g. Kaiser, Anthem Blue Cross"
          />
        </div>
      )}
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
  // §Phase 3 — answers to the "still applies?" confirmation for needs the
  // record already knows about. Separate from `needs`, which stays the raw
  // four-checkbox capture for categories with no prior evidence.
  const [knownAnswers, setKnownAnswers] = useState<
    Partial<Record<IntakeNeedKey, "yes" | "no">>
  >({});
  const [coverage, setCoverage] = useState<{
    status: CoverageStatus;
    countyOfRelease: string;
    jiReentryFlag: boolean;
    otherPlanName?: string;
    /** Payer bucket — independent of justice involvement. */
    coverageType: CoverageType;
    /** Justice-involvement history — independent of the payer. */
    justiceInvolvement: TriState;
    /** CalAIM ECM follow-up; only asked under Medi-Cal / dual. */
    ecmEligible: boolean;
  }>({
    status: "active",
    countyOfRelease: "Tulare",
    jiReentryFlag: false,
    otherPlanName: "",
    coverageType: "medi_cal",
    justiceInvolvement: "no",
    ecmEligible: false,
  });
  /**
   * §Front-door Phase 2 — safety-net record lookup.
   *
   * DECISION (made, not assumed): the lookup is DISCLOSED, not silent. A
   * silent background search on a justice-involved population reads as
   * surveillance the moment anyone discovers it, and this flow's whole premise
   * is that the person may already be in a system they weren't told about.
   * Disclosure also has a practical payoff: the person can say "yes, that was
   * at Kern" and resolve an ambiguous match a deterministic rule can't.
   */
  const [lookup, setLookup] = useState<(LookupResult & { ran: boolean }) | null>(null);
  const acting = useActingStaff();
  // Phase 1c — optional, general-population path only.
  const [heardAbout, setHeardAbout] = useState<HeardAboutSource | "">("");
  // §Reporting Tier 2 — patient-estimated history. Every value here is the
  // person's own recollection; nothing is verified against a facility record.
  // Seeded from the structured CalomsProfile already on file, like every other
  // intake step, so a re-run edits what exists instead of blanking it.
  const [history, setHistory] = useState<IntakeHistory>(() => seedIntakeHistory(patient));
  const historyOnFile = hasExistingHistory(patient);
  // P1 — About you. Seeded from the record on the very first render so nobody
  // retypes what sign-up (or a CF Care Manager) already entered.
  const [profile, setProfile] = useState<IntakeProfile>(() => seedIntakeProfile(patient));
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /**
   * §Consent re-prompt gate.
   *
   * Intake is re-enterable (re-screen tasks deep-link straight back here).
   * Re-asking for HIPAA + Part 2 acknowledgment when a valid consent is
   * already on the ledger is both noise and a real compliance hazard: an
   * abandoned or declined redundant prompt must never downgrade a live
   * consent. Read the SAME live ledger every other gate reads — no cached
   * copy — and skip the step entirely when consent is genuinely in force.
   * Changing or revoking consent happens on /consent, never as a side effect
   * of re-screening.
   */
  const consentOnFile = useEhr(() => {
    const p = AdelanteEHR.getPatient(currentId);
    if (!p?.consents?.signedAt || !p.consents.hipaa) return null;
    return {
      signedAt: p.consents.signedAt,
      part2Sud: AdelanteEHR.isConsentCategoryAuthorized(currentId, "sud_treatment"),
    };
  });
  // Effective values: the ledger wins whenever it has something to say, so a
  // stale local draft can't contradict it.
  const effectiveHipaa = consentOnFile ? true : hipaaConsent;
  const effectiveSud: boolean | null = consentOnFile ? consentOnFile.part2Sud : sudConsent;

  // Re-seed if the acting patient changes mid-session (assisted mode).
  useEffect(() => {
    setProfile(seedIntakeProfile(patient));
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
      // Merge, never overwrite: a blank field in an old draft must not erase
      // something the record actually knows.
      if (saved.profile) {
        setProfile(mergeSavedIntakeProfile(seedIntakeProfile(patient), saved.profile));
      }
      if (saved.savedAt) setSavedAt(saved.savedAt);
    } catch {
      /* no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Phase 1c gate. Only the general-population path is asked how they found
   * us; anyone with a known source is skipped. "Known source" is two things in
   * the data model: `patient.referralId` (set when a formal `Referral`
   * submission is advanced to enrolled) and an open `PreReleaseEpisode`
   * (Track A pre-release) — both surfaced by `hasKnownReferralSource`.
   */
  const knownSource = useEhr(() => AdelanteEHR.hasKnownReferralSource(currentId));
  // §Phase 3 — what the record already knows about this person's social needs,
  // so the Needs step confirms rather than blindly re-asks.
  const needsPlan = useMemo(
    () =>
      buildIntakeNeedsPlan({
        domains: patient?.screeners?.["ahc-hrsn"]?.domains,
        items: patient?.sdohPlan?.items,
      }),
    [patient],
  );
  const frontDoor = useEhr(() => AdelanteEHR.getFrontDoorEntry(currentId));
  const askHeardAbout = shouldAskHeardAbout({
    // No front-door record (e.g. deep-linked straight into intake) is treated
    // as the general-population path, which is what /start Q3 = yes produces.
    seekingCareForSelf: (frontDoor?.seekingCareForSelf ?? "yes") === "yes",
    existingCare: frontDoor?.existingCare ?? "no",
    hasReferralRecord: Boolean(patient?.referralId),
    hasPreReleaseEpisode: knownSource && !patient?.referralId,
  });

  const lookupApplies = shouldRunSafetyNetLookup({
    recordLookupPending: frontDoor?.recordLookupPending,
    justiceInvolvement: coverage.justiceInvolvement,
    existingPlanFound: knownSource,
  });
  useEffect(() => {
    if (!lookupApplies || !currentId) return;
    setLookup(
      AdelanteEHR.runSafetyNetRecordLookup(currentId, {
        justiceInvolvement: coverage.justiceInvolvement,
      }),
    );
  }, [lookupApplies, currentId, coverage.justiceInvolvement]);
  const missedHandoff = Boolean(lookup?.ran && lookup.status === "none");

  // Build step list: welcome, consent, screeners (filter SUD if no consent), needs, review
  const activeScreeners = useMemo(
    () => SCREENERS.filter((s) => !s.isSud || effectiveSud === true),
    [effectiveSud],
  );
  const steps = useMemo(
    () => [
      { key: "welcome", label: "Welcome" },
      { key: "about", label: "About you" },
      ...(consentOnFile ? [] : [{ key: "consent", label: "Consent" }]),
      { key: "coverage", label: "Coverage" },
      ...activeScreeners.map((s) => ({ key: s.key, label: s.name })),
      { key: "needs", label: "Needs" },
      // §Reporting Tier 2 — structured CalOMS-shaped history. Only asked when
      // it genuinely applies: substance questions require Part 2 consent
      // (they are SUD content), justice questions require reported justice
      // involvement. Both are recorded as the patient's own estimate.
      ...(effectiveSud === true || coverage.justiceInvolvement === "yes"
        ? [{ key: "history", label: "History" }]
        : []),
      ...(askHeardAbout ? [{ key: "source", label: "How you found us" }] : []),
      { key: "review", label: "Review" },
    ],
    [activeScreeners, askHeardAbout, consentOnFile, effectiveSud, coverage.justiceInvolvement],
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
      // Writing the list keeps `emergencyContact` (legacy primary) in sync.
      emergencyContacts: cleanEmergencyContacts(profile.emergencyContacts),
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
      coverageType: coverage.coverageType,
      justiceInvolvement: coverage.justiceInvolvement,
      ecmEligible: ecmQuestionApplies(coverage.coverageType) ? coverage.ecmEligible : false,
      otherPlanName: coverage.status === "other" ? coverage.otherPlanName : undefined,
    });
    // §Front-door Phase 2 — no match on the safety-net lookup means a genuine
    // missed hand-off: generate the CF Care Manager's own pre-release task
    // list, compressed to day one, owned by whoever is running this session.
    if (missedHandoff) {
      try {
        AdelanteEHR.generateMissedHandoffCatchUp({
          patientId: currentId,
          ownerStaffId: acting.staffId,
          ownerName: acting.staffName || "Intake staff",
          ownerRole: acting.role,
          trigger: frontDoor?.recordLookupPending ? "record_lookup_pending" : "justice_involvement",
        });
      } catch {
        /* no-op */
      }
    }
    // §Reporting Tier 2 — persist the structured history as the patient's own
    // estimate. Written through the typed setters so it lands queryable.
    // Each block is written only when the step actually carries a value, and
    // the form was seeded from what is already on file, so a re-run is an
    // explicit edit of visible values rather than a silent blanking.
    const toNum = (s: string) => (s.trim() === "" ? undefined : Number(s));
    if (effectiveSud === true && history.substance) {
      AdelanteEHR.setSubstanceUseProfile(currentId, {
        entries: [
          {
            rank: "primary",
            substance: history.substance,
            route: history.route,
            frequency: history.frequency,
            ageAtFirstUse: toNum(history.ageAtFirstUse),
          },
        ],
        source: "self_report",
      });
    }
    if (effectiveSud === true && history.priorEpisodes) {
      AdelanteEHR.setPriorTreatmentHistory(currentId, {
        priorEpisodes: history.priorEpisodes,
        lastTreatmentType: history.lastTreatmentType,
        source: "self_report",
      });
    }
    if (coverage.justiceInvolvement === "yes") {
      const arrests = toNum(history.arrestsPast12Months);
      const custody = toNum(history.timeInCustodyMonths);
      if (arrests !== undefined || custody !== undefined || history.justiceReferralSource) {
        AdelanteEHR.setJusticeSelfReport(currentId, {
          arrestsPast12Months: arrests,
          timeInCustodyMonths: custody,
          justiceReferralSource: history.justiceReferralSource,
        });
      }
    }
    if (askHeardAbout && heardAbout) {
      AdelanteEHR.recordFrontDoorEntry(currentId, { heardAbout });
    }
    AdelanteEHR.completeIntake(currentId, {
      needs,
      hipaa: effectiveHipaa,
      part2Sud: effectiveSud === true,
    });
    if (crisisFlagged) {
      // Legacy soft flag — still read by case-manager / caseload / referral filters.
      AdelanteEHR.raiseCrisisFlag(currentId, "phq-9-item-9");
      // Real escalation — PatientAlert + open CrisisEscalation + coordinator notification.
      try {
        AdelanteEHR.flagCrisis(
          currentId,
          "Intake screener (automated)",
          "Automated flag: PHQ-9 item 9 indicated risk of self-harm",
          { triggerSource: "screener_score" },
        );
      } catch {
        /* no-op */
      }
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
      {consentOnFile && (
        <Card className="mb-4 p-4 bg-secondary/50 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-teal mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-navy">
              Your consent is already on file — we won't ask again.
            </div>
            <div className="text-muted-foreground">
              HIPAA acknowledged, and substance-use sharing is currently{" "}
              <strong className="text-foreground">
                {consentOnFile.part2Sud ? "allowed" : "not allowed"}
              </strong>
              . Nothing you do here changes that.{" "}
              <Link to="/consent" className="underline text-teal">
                Review or change your consent
              </Link>
              .
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

            {/* Language is promoted above the rest of this step: it drives the
                app's language, Adel's replies, and — critically — the language
                of crisis-response messages. Shown bilingually so it reads
                clearly to both English and Spanish speakers. */}
            <div className="rounded-lg border-2 border-teal/60 bg-teal/5 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Languages className="h-5 w-5 text-teal mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <Label className="text-base font-semibold leading-tight">
                    What language should we use with you?
                    <span className="block text-muted-foreground font-normal text-sm">
                      ¿En qué idioma debemos hablarle?
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This sets the language of the whole app and any messages we send you — including
                    urgent support messages. / Esto define el idioma de toda la aplicación y de
                    cualquier mensaje que le enviemos, incluidos los mensajes urgentes de apoyo.
                  </p>
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label="Preferred language / Idioma preferido"
                className="grid grid-cols-2 gap-2"
              >
                {(
                  [
                    { value: "en", label: "English" },
                    { value: "es", label: "Español" },
                  ] as const
                ).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={profile.preferredLanguage === opt.value ? "default" : "outline"}
                    className={
                      profile.preferredLanguage === opt.value
                        ? "h-11 text-base font-semibold"
                        : "h-11 text-base"
                    }
                    aria-pressed={profile.preferredLanguage === opt.value}
                    onClick={() => setProfile({ ...profile, preferredLanguage: opt.value })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

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
              <div>
                <div className="text-sm font-medium text-navy">Emergency contacts</div>
                <p className="text-xs text-muted-foreground">
                  List as many people as you want us to be able to reach. The first one is who we
                  try first.
                </p>
              </div>
              {profile.emergencyContacts.map((c, i) => (
                <div key={i} className="space-y-3 rounded-md border bg-card p-3" data-testid="emergency-contact-row">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {i === 0 ? "Primary contact" : `Contact ${i + 1}`}
                    </span>
                    {profile.emergencyContacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove contact ${i + 1}`}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            emergencyContacts: profile.emergencyContacts.filter(
                              (_, idx) => idx !== i,
                            ),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(
                      [
                        { key: "name", placeholder: "Name", type: "text" },
                        { key: "relationship", placeholder: "Relationship", type: "text" },
                        { key: "phone", placeholder: "Phone", type: "tel" },
                        { key: "email", placeholder: "Email", type: "email" },
                      ] as const
                    ).map((f) => (
                      <Input
                        key={f.key}
                        type={f.type}
                        placeholder={f.placeholder}
                        aria-label={`${f.placeholder} — contact ${i + 1}`}
                        value={c[f.key] ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            emergencyContacts: profile.emergencyContacts.map((row, idx) =>
                              idx === i ? { ...row, [f.key]: e.target.value } : row,
                            ),
                          })
                        }
                      />
                    ))}
                    <Input
                      className="sm:col-span-2"
                      placeholder="Address"
                      aria-label={`Address — contact ${i + 1}`}
                      value={c.address ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          emergencyContacts: profile.emergencyContacts.map((row, idx) =>
                            idx === i ? { ...row, address: e.target.value } : row,
                          ),
                        })
                      }
                    />
                    <Input
                      className="sm:col-span-3"
                      placeholder="Notes — best times, what they know, anything we should be careful about"
                      aria-label={`Notes — contact ${i + 1}`}
                      value={c.notes ?? ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          emergencyContacts: profile.emergencyContacts.map((row, idx) =>
                            idx === i ? { ...row, notes: e.target.value } : row,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setProfile({
                    ...profile,
                    emergencyContacts: [...profile.emergencyContacts, emptyEmergencyContact()],
                  })
                }
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add another contact
              </Button>
            </div>
          </div>
        )}

        {current.key === "coverage" && (
          <div className="space-y-5">
            <div>
              <Badge variant="outline" className="border-teal/40 text-teal">
                Coverage
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Two separate things: how your care gets paid for, and whether you've been involved
                with the justice system. Neither one decides the other, and neither one changes the
                care you get.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">County</Label>
              <input
                value={coverage.countyOfRelease}
                onChange={(e) => setCoverage({ ...coverage, countyOfRelease: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">What kind of coverage do you have?</Label>
              <Select
                value={coverage.coverageType}
                onValueChange={(v) =>
                  setCoverage({
                    ...coverage,
                    coverageType: v as CoverageType,
                    // ECM only exists under Medi-Cal / dual — clear it otherwise.
                    ecmEligible: ecmQuestionApplies(v as CoverageType) ? coverage.ecmEligible : false,
                  })
                }
              >
                <SelectTrigger aria-label="Coverage type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGE_TYPES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ecmQuestionApplies(coverage.coverageType) && (
              <label
                className="flex items-start gap-2 text-sm cursor-pointer rounded-md border bg-secondary/40 p-3"
                data-testid="ecm-followup"
              >
                <Checkbox
                  checked={coverage.ecmEligible}
                  onCheckedChange={(v) => setCoverage({ ...coverage, ecmEligible: Boolean(v) })}
                />
                <span>
                  Do you have ongoing health, housing, or other complex needs? (This may qualify you
                  for Enhanced Care Management — extra coordination at no cost.)
                </span>
              </label>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm">
                Have you ever been involved with the justice system — jail, prison, probation, or
                parole?
              </Label>
              <RadioGroup
                className="grid gap-2"
                value={coverage.justiceInvolvement}
                onValueChange={(v) =>
                  setCoverage({ ...coverage, justiceInvolvement: v as TriState })
                }
              >
                {(
                  [
                    { key: "yes", label: "Yes" },
                    { key: "no", label: "No" },
                    { key: "unsure", label: "I'm not sure" },
                  ] as { key: TriState; label: string }[]
                ).map((o) => (
                  <label
                    key={o.key}
                    htmlFor={`ji-${o.key}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm"
                  >
                    <RadioGroupItem id={`ji-${o.key}`} value={o.key} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Medi-Cal record status (if you have one)</Label>
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

            {lookupApplies && (
              <div
                data-testid="safety-net-lookup"
                className="rounded-lg border bg-secondary/40 p-4 text-sm space-y-2"
              >
                <div className="flex items-center gap-2 font-medium text-navy">
                  <Search className="h-4 w-4 text-teal" /> We're checking for an existing plan
                </div>
                <p className="text-muted-foreground">{LOOKUP_DISCLOSURE}</p>
                {lookup?.status === "match" && (
                  <div className="space-y-2">
                    <p className="text-foreground">
                      We found a record that looks like yours. Let's get you back into it instead of
                      starting over.
                    </p>
                    <Button asChild size="sm">
                      <Link to="/start/reconnect">Reconnect to my record</Link>
                    </Button>
                  </div>
                )}
                {lookup?.status === "ambiguous" && (
                  <div className="space-y-2">
                    <p className="text-foreground">
                      We found more than one possible record, so a person needs to check which one
                      is yours.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/start/reconnect">Have someone check</Link>
                    </Button>
                  </div>
                )}
                {missedHandoff && (
                  <div className="space-y-1" data-testid="missed-handoff-notice">
                    <p className="text-foreground">
                      We didn't find a plan started for you. That means coordination that should
                      have happened before your release didn't — so we'll do all of it today
                      instead, starting with your Medi-Cal.
                    </p>
                    <p className="text-muted-foreground">{MEDI_CAL_FOLLOW_UP_MESSAGE}</p>
                  </div>
                )}
              </div>
            )}

            <CoverageCallout
              coverageType={coverage.coverageType}
              justiceInvolvement={coverage.justiceInvolvement}
              county={coverage.countyOfRelease}
              otherPlanName={coverage.otherPlanName ?? ""}
              onOtherPlanChange={(v) => setCoverage({ ...coverage, otherPlanName: v })}
            />

            {coverage.justiceInvolvement !== "no" && (
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
            )}
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
          <div className="space-y-5" data-testid="needs-step">
            {/* §Phase 3 — already-known needs are confirmed, not re-asked. */}
            {needsPlan.known.length > 0 && (
              <div className="space-y-3" data-testid="needs-known">
                <div>
                  <h3 className="text-sm font-medium">What we already know</h3>
                  <p className="text-sm text-muted-foreground">
                    These are already on your record. Tell us whether each one still applies — you
                    don&apos;t have to answer them again from scratch.
                  </p>
                </div>
                {needsPlan.known.map((row) => (
                  <div
                    key={row.intakeKey}
                    className="rounded-lg border p-3 space-y-2"
                    data-testid={`needs-known-${row.intakeKey}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{row.need}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {SDOH_SOURCE_LABEL[row.source]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.evidence}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={knownAnswers[row.intakeKey] === "yes" ? "default" : "outline"}
                        data-testid={`needs-known-${row.intakeKey}-yes`}
                        onClick={() =>
                          setKnownAnswers((s) => ({ ...s, [row.intakeKey]: "yes" }))
                        }
                      >
                        Still applies
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={knownAnswers[row.intakeKey] === "no" ? "default" : "outline"}
                        data-testid={`needs-known-${row.intakeKey}-no`}
                        onClick={() => setKnownAnswers((s) => ({ ...s, [row.intakeKey]: "no" }))}
                      >
                        This has changed
                      </Button>
                    </div>
                    {knownAnswers[row.intakeKey] === "no" && (
                      <p className="text-xs text-muted-foreground">
                        Thanks — we&apos;ll leave it on your plan for now and someone on your care
                        team will go over it with you.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Positive HRSN domains intake cannot honestly confirm or deny. */}
            {needsPlan.onFileOnly.length > 0 && (
              <div
                className="rounded-lg border border-amber-warm/60 bg-amber-warm/10 p-3 space-y-2"
                data-testid="needs-on-file-only"
              >
                <h3 className="text-sm font-medium">Also on file from your earlier screening</h3>
                <p className="text-xs text-muted-foreground">
                  Your care team already has these. We&apos;re not asking about them here — they
                  came from a full screening, and this short form isn&apos;t the right place to
                  change them. Your care team will follow up with you directly.
                </p>
                <ul className="space-y-1">
                  {needsPlan.onFileOnly.map((d) => (
                    <li
                      key={d.domainKey}
                      className="text-sm"
                      data-testid={`needs-on-file-${d.domainKey}`}
                    >
                      • {d.domainLabel}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {needsPlan.capture.length > 0 && (
              <div className="space-y-3" data-testid="needs-capture">
                <p className="text-sm text-muted-foreground">
                  {needsPlan.known.length > 0 || needsPlan.onFileOnly.length > 0
                    ? "Anything else you need help with right now? Select all that apply."
                    : "Tell us what support you need right now. Select all that apply."}
                </p>
                {needsPlan.capture.map((k) => (
                  <label
                    key={k}
                    className="flex items-center min-h-11 gap-3 rounded-lg border py-3 px-3 cursor-pointer hover:border-teal"
                  >
                    <Checkbox
                      checked={needs[k]}
                      data-testid={`needs-capture-${k}`}
                      onCheckedChange={(v) => setNeeds({ ...needs, [k]: Boolean(v) })}
                    />
                    <span className="text-sm">{INTAKE_NEED_LABEL[k]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {current.key === "history" && (
          <div className="space-y-4" data-testid="history-step">
            <p className="text-sm text-muted-foreground">
              A few optional background questions. Answer only what you want to — your care team
              records these as your own estimate.
            </p>
            {historyOnFile && (
              <p
                className="rounded-lg border border-amber-warm/60 bg-amber-warm/10 p-3 text-xs"
                data-testid="history-prefilled-notice"
              >
                Some answers are already on file and shown below. Change anything that&apos;s out of
                date — what you leave as-is stays as-is.
              </p>
            )}

            {effectiveSud === true && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">Substance use</h3>
                  <ProvenanceBadge source="self_report" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Main substance</Label>
                  <Select
                    value={history.substance ?? ""}
                    onValueChange={(v) =>
                      setHistory({ ...history, substance: v as CalomsSubstance })
                    }
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CALOMS_SUBSTANCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SUBSTANCE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">How you mainly use it</Label>
                  <Select
                    value={history.route ?? ""}
                    onValueChange={(v) => setHistory({ ...history, route: v as CalomsRoute })}
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CALOMS_ROUTES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROUTE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">How often in the past 30 days</Label>
                  <Select
                    value={history.frequency ?? ""}
                    onValueChange={(v) =>
                      setHistory({ ...history, frequency: v as CalomsFrequency })
                    }
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CALOMS_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FREQUENCY_LABEL[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Age you first used it (your estimate)</Label>
                  <Input
                    className="min-h-11"
                    inputMode="numeric"
                    value={history.ageAtFirstUse}
                    onChange={(e) => setHistory({ ...history, ageAtFirstUse: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Times you&apos;ve been in treatment before</Label>
                  <Select
                    value={history.priorEpisodes ?? ""}
                    onValueChange={(v) =>
                      setHistory({ ...history, priorEpisodes: v as PriorEpisodeBucket })
                    }
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIOR_EPISODE_BUCKETS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {PRIOR_EPISODE_LABEL[b]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kind of treatment last time</Label>
                  <Select
                    value={history.lastTreatmentType ?? ""}
                    onValueChange={(v) =>
                      setHistory({ ...history, lastTreatmentType: v as PriorTreatmentType })
                    }
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIOR_TREATMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {PRIOR_TREATMENT_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {coverage.justiceInvolvement === "yes" && (
              <div className="space-y-3 rounded-lg border border-amber-warm/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">Court or custody history</h3>
                  <ProvenanceBadge source="self_report" />
                </div>
                <p className="text-xs text-muted-foreground">{JUSTICE_SELF_REPORT_NOTE}</p>
                <div className="space-y-1">
                  <Label className="text-xs">Arrests in the past 12 months (your estimate)</Label>
                  <Input
                    className="min-h-11"
                    inputMode="numeric"
                    value={history.arrestsPast12Months}
                    onChange={(e) =>
                      setHistory({ ...history, arrestsPast12Months: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Months in custody (your estimate)</Label>
                  <Input
                    className="min-h-11"
                    inputMode="numeric"
                    value={history.timeInCustodyMonths}
                    onChange={(e) =>
                      setHistory({ ...history, timeInCustodyMonths: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Who referred you</Label>
                  <Select
                    value={history.justiceReferralSource ?? ""}
                    onValueChange={(v) =>
                      setHistory({ ...history, justiceReferralSource: v as JusticeReferralSource })
                    }
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {JUSTICE_REFERRAL_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {JUSTICE_REFERRAL_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {current.key === "source" && (
          <div className="space-y-3" data-testid="heard-about-step">
            <p className="text-sm text-muted-foreground">
              Optional — how did you hear about Adelante? It helps us know what's working. You can
              skip this.
            </p>
            <RadioGroup
              className="grid gap-2"
              value={heardAbout}
              onValueChange={(v) => setHeardAbout(v as HeardAboutSource)}
            >
              {HEARD_ABOUT_SOURCES.map((s) => (
                <label
                  key={s.key}
                  htmlFor={`heard-${s.key}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm hover:border-teal"
                >
                  <RadioGroupItem id={`heard-${s.key}`} value={s.key} />
                  <span>{s.label}</span>
                </label>
              ))}
            </RadioGroup>
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
