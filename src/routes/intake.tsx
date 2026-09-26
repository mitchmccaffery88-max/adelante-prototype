import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Slim988Bar } from "@/components/patient/Slim988Bar";
import { INTAKE_WELCOME_COPY, REASSESS_START_COPY } from "@/lib/intakeWelcomeCopy";
import { rescreenName } from "@/lib/reassessmentCopy";
import { intakeScreeners } from "@/lib/seeking";
import { BACKGROUND_COPY } from "@/lib/intakeBackgroundCopy";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { scoreScreener } from "@/lib/screeners";
import { ScreenerItems } from "@/components/screeners/ScreenerItems";
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
import { IntakeMatchPreview } from "@/components/patient/NeedConnect";
import {
  OPTIONAL_TOPICS,
  URGENCIES,
  URGENCY_LABEL,
  WHAT_HELPS_COPY,
  HRSN_DOMAIN_CATEGORY,
  outsideKnownNeeds,
  shouldSkipCoreQuestions,
  patientSafeNeedLabel,
  provenanceFor,
  type NeedUrgency,
  type OptionalTopicKey,
} from "@/lib/whatWouldHelp";
import { INTAKE_NEED_LABEL, type IntakeNeedKey } from "@/lib/sdohMapping";
import { emptyEmergencyContact } from "@/lib/emergencyContacts";
import {
  mergeSavedIntakeProfile,
  profilePatch,
  seedIntakeProfile,
  type IntakeProfile,
} from "@/lib/intakeProfile";
import { Input } from "@/components/ui/input";
import { intakeCoveragePatch } from "@/lib/coverageStatus";
import { BenefitsStep, benefitsCinProblem, selectedPlanSnapshot } from "@/components/intake/BenefitsStep";
import {
  benefitsAnswers,
  benefitsFormFromPatient,
  isMediCalChoice,
  recordIntakeBenefits,
  type BenefitsFormState,
} from "@/lib/intakeBenefits";
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
import { ReleaseDateProvenance } from "@/components/ReleaseDateProvenance";
import { Link } from "@tanstack/react-router";
import { useActingStaff } from "@/lib/roles";
import { AskAdelHelp } from "@/components/patient/AskAdelHelp";
import { AdelGuidedIntake } from "@/components/intake/AdelGuidedIntake";
import { ADEL_COPY } from "@/lib/adelIntakeScript";
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
  Clock,
  ClipboardList,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { PHASE9A_COPY } from "@/lib/phase9aCopy";

/** §Phase 9a — justice involvement is already known from the record. */
function justiceKnownFor(patientId: string | null | undefined): boolean {
  if (!patientId) return false;
  const p = AdelanteEHR.getPatient(patientId);
  return Boolean(p?.custody) || AdelanteEHR.listPreReleaseEpisodes(patientId).length > 0;
}

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
}: {
  coverageType: CoverageType;
  justiceInvolvement: TriState;
  county: string;
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
    </div>
  );
}

function IntakePage() {
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const justiceKnown = useEhr(() => justiceKnownFor(currentId));
  const { lang: lang9a } = useI18n();
  const c9a = PHASE9A_COPY[lang9a === "es" ? "es" : "en"];
  const alreadyComplete = Boolean(patient?.intakeCompletedAt);
  // §Onboarding rework — re-assess entry for people who already finished
  // intake: one "anything changed?" question, then what's due.
  const [reassess, setReassess] = useState<"ask" | "about" | "due" | "full">("ask");
  const inReassess = alreadyComplete && reassess !== "full";
  const W = INTAKE_WELCOME_COPY[lang9a === "es" ? "es" : "en"];
  const R = REASSESS_START_COPY[lang9a === "es" ? "es" : "en"];
  const dueJson = useEhr(() => JSON.stringify(AdelanteEHR.patientReassessmentDue(currentId)));
  const due = JSON.parse(dueJson) as { key: string }[];
  const [step, setStep] = useState(0);
  // §Adel-guided intake (prototype) — opt-in; the form stays the default.
  const [adelMode, setAdelMode] = useState(false);
  const [sudConsent, setSudConsent] = useState<boolean | null>(null);
  const [hipaaConsent, setHipaaConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  // §Phase 10a — chosen option index per item (AHC-HRSN has choices that share a score).
  const [choices, setChoices] = useState<Record<string, Record<number, number>>>({});
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
  }>(() => ({
    // §Phase 8a — seeded from the record on file so a re-run edits, not blanks.
    status:
      patient?.coverage && ["active", "suspended", "none_unsure"].includes(patient.coverage.status)
        ? patient.coverage.status
        : "active",
    countyOfRelease: patient?.coverage?.countyOfRelease ?? "Tulare",
    jiReentryFlag: patient?.coverage?.jiReentryFlag ?? false,
    otherPlanName: patient?.coverage?.otherPlanName ?? "",
    coverageType: patient?.coverage?.coverageType ?? "medi_cal",
    // §Phase 9a — a pre-release episode or custody status on file already
    // answers this; it is shown as known rather than re-asked.
    justiceInvolvement: justiceKnownFor(patient?.id)
      ? "yes"
      : (patient?.coverage?.justiceInvolvement ?? "no"),
    ecmEligible: patient?.coverage?.ecmEligible ?? false,
  }));
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
  // §Phase 8b — the shared benefits step's state, seeded from the record.
  const [benefits, setBenefits] = useState<BenefitsFormState>(() => benefitsFormFromPatient(currentId));
  const onBenefitsChange = (v: BenefitsFormState) => {
    setBenefits(v);
    const a = benefitsAnswers(v);
    const type = a?.coverageType ?? "unknown";
    setCoverage((c) => ({
      ...c,
      coverageType: type,
      status: isMediCalChoice(v.choice) ? v.mediCalStatus : c.status,
      otherPlanName: v.planName,
      ecmEligible: ecmQuestionApplies(type) ? c.ecmEligible : false,
    }));
  };
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
  // §Part B1 — background questions on About You.
  const [seeking, setSeeking] = useState(() => ({
    mentalHealth: patient?.seeking?.mentalHealth ?? false,
    medication: patient?.seeking?.medication ?? false,
    substanceUse: false,
    notSure: patient?.seeking?.notSure ?? false,
  }));
  // §Needs step 1 — optional topics with one "how soon" follow-up each.
  const [topics, setTopics] = useState<Partial<Record<OptionalTopicKey, NeedUrgency | "">>>({});
  // Core AHC-HRSN questions are skipped (confirm instead) when the record
  // already knows — recent result or outside-sourced needs.
  const [coreChoice, setCoreChoice] = useState<"confirm" | "update" | null>(null);
  /** Index of the emergency contact also invited as advocate, or null. */
  const [advocateFromContact, setAdvocateFromContact] = useState<number | null>(null);
  const [advocateOther, setAdvocateOther] = useState({
    on: false,
    name: "",
    relationship: "",
    contact: "",
    channel: "sms" as "sms" | "email",
  });
  const B = BACKGROUND_COPY[lang9a === "es" ? "es" : "en"];
  const H = WHAT_HELPS_COPY[lang9a === "es" ? "es" : "en"];
  const langKey: "en" | "es" = lang9a === "es" ? "es" : "en";
  const skipCore = useMemo(() => shouldSkipCoreQuestions(patient), [patient]);
  const askCore = !skipCore || coreChoice === "update";
  const outsideNeeds = useMemo(() => outsideKnownNeeds(patient?.sdohPlan?.items), [patient]);

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
    setBenefits(benefitsFormFromPatient(currentId));
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
      if (saved.benefits) setBenefits(saved.benefits);
      if (saved.seeking) setSeeking(saved.seeking);
      if (saved.topics) setTopics(saved.topics);
      if (saved.coreChoice !== undefined) setCoreChoice(saved.coreChoice);
      if (saved.advocateFromContact !== undefined) setAdvocateFromContact(saved.advocateFromContact);
      if (saved.advocateOther) setAdvocateOther(saved.advocateOther);
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
          benefits,
          profile,
          seeking,
          topics,
          coreChoice,
          advocateFromContact,
          advocateOther,
          savedAt: at,
        }),
      );
      setSavedAt(at);
    } catch {
      /* no-op */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sudConsent, hipaaConsent, answers, needs, coverage, benefits, profile, seeking, topics, coreChoice, advocateFromContact, advocateOther]);

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
    // Unchanged screener logic: Part 2 consent only, never the "looking for" answers.
    () => intakeScreeners(effectiveSud),
    [effectiveSud],
  );
  const hrsnDef = activeScreeners.find((s) => s.key === "ahc-hrsn");
  const steps = useMemo(
    () => [
      { key: "welcome", label: "Welcome" },
      { key: "about", label: "About you" },
      ...(consentOnFile ? [] : [{ key: "consent", label: "Consent" }]),
      { key: "coverage", label: "Coverage" },
      // AHC-HRSN core is asked inside "What would help you", not as its own step.
      ...activeScreeners.filter((s) => s.key !== "ahc-hrsn").map((s) => ({ key: s.key, label: s.name })),
      { key: "needs", label: "What would help you" },
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
    if (benefitsCinProblem(benefits)) {
      toast.error("The Medi-Cal ID needs 9 letters or numbers — fix it on the Coverage step.");
      return;
    }
    // P1 — persist the About-you patch first.
    AdelanteEHR.updateProfile(currentId, profilePatch(profile));
    activeScreeners.forEach((s) => {
      // §Needs step 1 — AHC-HRSN only saved when it was actually asked.
      if (s.key === "ahc-hrsn" && !askCore) return;
      // §Phase 10a — shared scoring (gate items, domains) and raw answers
      // stored on the record; still the one `recordScreener` path.
      const raw = answers[s.key] ?? [];
      const ans = s.questions.map((_, i) => (typeof raw[i] === "number" ? raw[i] : 0));
      const scored = scoreScreener(s, ans);
      const isPhq = s.key === "phq-9";
      const itemFlag = isPhq && (ans[8] ?? 0) > 0;
      AdelanteEHR.recordScreener(currentId, {
        key: s.key,
        score: scored.score,
        severity: scored.severity,
        completedAt: new Date().toISOString(),
        timepoint: "intake",
        crisisFlag: itemFlag,
        responses: ans,
        context: "intake",
        ...(scored.positive !== undefined ? { positive: scored.positive } : {}),
        ...(scored.domains ? { domains: scored.domains } : {}),
      });
    });
    // §Phase 8a — merge, never replace; self-report, never "verified".
    AdelanteEHR.setCoverage(
      currentId,
      intakeCoveragePatch(patient?.coverage, {
        coverageType: coverage.coverageType,
        mediCalStatus: coverage.status,
        countyOfRelease: coverage.countyOfRelease,
        jiReentryFlag: coverage.jiReentryFlag,
        justiceInvolvement: coverage.justiceInvolvement,
        ecmEligible: coverage.ecmEligible,
        otherPlanName: coverage.otherPlanName,
      }),
      { id: currentId, role: "patient", source: "intake_self_service" },
    );
    // §Phase 8b — the shared benefits write path (CIN, plan span, reported
    // record, billing prompt). Attributed to who actually entered it.
    const benefitAnswers = benefitsAnswers(benefits, selectedPlanSnapshot(benefits.planId));
    if (benefitAnswers) {
      recordIntakeBenefits(currentId, benefitAnswers, { source: "patient_reported", via: "self_service_intake", actorId: currentId, actorName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient", actorRole: "patient" });
    }
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
    // §Phase 3 — real SDOH rows, with honest provenance. Confirmed needs keep
    // the source they were ESTABLISHED with (a pre-release HRSN finding stays
    // `pre_release_hrsn`); only genuinely new, self-ticked needs are written as
    // `intake_self_report`. Needs on file that the person did NOT confirm are
    // left standing for a human to work — intake cannot resolve them.
    AdelanteEHR.applyIntakeNeeds(currentId, {
      confirmed: needsPlan.known
        .filter((r) => knownAnswers[r.intakeKey] === "yes")
        .map((r) => ({
          need: r.need,
          source: r.source,
          ...(r.existingItemId ? { existingItemId: r.existingItemId } : {}),
        })),
      selfReported: [
        // Positive AHC-HRSN domains from the core questions just asked.
        ...(askCore && hrsnDef
          ? (scoreScreener(hrsnDef, hrsnDef.questions.map((_, i) => answers["ahc-hrsn"]?.[i] ?? 0)).domains ?? [])
              .filter((d) => d.positive)
              .map((d) => ({
                need: d.label,
                categoryId: HRSN_DOMAIN_CATEGORY[d.key],
                ...(d.key === "safety" ? { safetySensitive: true } : {}),
              }))
          : []),
        // Optional topics, each with its "how soon".
        ...OPTIONAL_TOPICS.filter((t) => topics[t.key] !== undefined).map((t) => ({
          need: t.need,
          categoryId: t.categoryId,
          ...(topics[t.key] ? { urgency: topics[t.key] as NeedUrgency } : {}),
        })),
      ],
    });
    // §Needs step 2 — same-day tasks (draft rule): a "today" topic, no steady
    // place to live, or an interpersonal-safety positive (staff only).
    AdelanteEHR.raiseNeedUrgencyTasks(currentId, {
      housingUnstable: askCore && choices["ahc-hrsn"]?.[0] === 2,
    });
    AdelanteEHR.completeIntake(currentId, {
      // Backward compatibility: the four booleans still reflect what intake
      // learned, including needs confirmed through the "still applies" path.
      needs: {
        ...needs,
        ...(topics.work !== undefined ? { employment: true } : {}),
        ...Object.fromEntries(
          needsPlan.known
            .filter((r) => knownAnswers[r.intakeKey] === "yes")
            .map((r) => [r.intakeKey, true]),
        ),
      },
      hipaa: effectiveHipaa,
      part2Sud: effectiveSud === true,
    });
    // §Part B1 — "looking for": content/recommendations + SUGGESTED goals only.
    AdelanteEHR.recordSeeking(
      currentId,
      seeking.notSure ? { mentalHealth: false, medication: false, substanceUse: false, notSure: true } : seeking,
      { id: currentId, role: "patient" },
      { sudConsentGiven: effectiveSud === true },
    );
    // §Part B1 — advocate named at intake: a pending INVITATION only, through
    // the one existing mechanism. No access until the advocate claims and the
    // patient signs advocate consent; tier rules unchanged.
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Patient";
    const invites: { name: string; relationship: string; contact: string; channel: "sms" | "email" }[] = [];
    if (advocateFromContact !== null) {
      const c = profile.emergencyContacts[advocateFromContact];
      if (c?.name.trim() && (c.phone.trim() || c.email?.trim())) {
        invites.push({
          name: c.name,
          relationship: c.relationship,
          contact: c.phone.trim() || c.email!.trim(),
          channel: c.phone.trim() ? "sms" : "email",
        });
      }
    }
    if (advocateOther.on && advocateOther.name.trim() && advocateOther.contact.trim()) {
      invites.push(advocateOther);
    }
    for (const inv of invites) {
      try {
        AdelanteEHR.createAdvocateInvitation({
          patientId: currentId,
          advocateName: inv.name,
          relationship: inv.relationship,
          invitationSentTo: inv.contact,
          invitationChannel: inv.channel,
          expectedAuthorizationType: "family_participation",
          designatedBy: { actor: "patient", name: patientName },
        });
      } catch {
        /* no-op — the invite form on My Care remains available */
      }
    }
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
    // §Onboarding rework — land on My Care; Next Steps stays reachable there.
    navigate({ to: "/home" });
  };

  const aboutSection = (
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
                <ReleaseDateProvenance
                  patient={patient}
                  onConfirmed={(date) => setProfile({ ...profile, releaseDate: date })}
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
            {!inReassess && (
              <div className="space-y-4 rounded-lg border p-4" data-testid="about-background">
                <div className="text-sm font-medium text-navy">{B.heading}</div>
                  {justiceKnown ? (
              <div
                data-testid="justice-known"
                className="rounded-lg border bg-secondary/40 p-3 text-sm"
              >
                <div className="font-medium text-navy">{c9a.justiceKnownTitle}</div>
                <p className="mt-1 text-muted-foreground">{c9a.justiceKnownBody}</p>
              </div>
            ) : (
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
            )}

              </div>
            )}
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
                  {!inReassess && (
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        checked={advocateFromContact === i}
                        data-testid={`advocate-from-contact-${i}`}
                        onCheckedChange={(v) => setAdvocateFromContact(v ? i : null)}
                      />
                      <span>{B.alsoAdvocate}</span>
                    </label>
                  )}
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
              {!inReassess && (
                <div className="space-y-2 rounded-md border bg-card p-3" data-testid="name-advocate">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <Checkbox
                      checked={advocateOther.on}
                      data-testid="name-advocate-toggle"
                      onCheckedChange={(v) => setAdvocateOther({ ...advocateOther, on: Boolean(v) })}
                    />
                    <span>{B.nameAdvocate}</span>
                  </label>
                  {advocateOther.on && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input aria-label={B.advName} placeholder={B.advName} value={advocateOther.name} data-testid="name-advocate-name" onChange={(e) => setAdvocateOther({ ...advocateOther, name: e.target.value })} />
                      <Input aria-label={B.advRel} placeholder={B.advRel} value={advocateOther.relationship} onChange={(e) => setAdvocateOther({ ...advocateOther, relationship: e.target.value })} />
                      <Input aria-label={B.advContact} placeholder={B.advContact} value={advocateOther.contact} data-testid="name-advocate-contact" onChange={(e) => setAdvocateOther({ ...advocateOther, contact: e.target.value, channel: e.target.value.includes("@") ? "email" : "sms" })} />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{B.advocateNote}</p>
                </div>
              )}
            </div>
          </div>
          );

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
      {alreadyComplete && reassess === "full" && (
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
              {alreadyComplete ? R.eyebrow : "Intake & Screening"}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">
              {inReassess ? R.title : current.label}
            </h1>
          </div>
          {!inReassess && (
          <div className="flex rounded-full bg-secondary p-0.5 text-xs" role="group" aria-label={W.toggleLabel}>
            <button
              onClick={() => setAdelMode(false)}
              aria-pressed={!adelMode}
              data-testid="intake-mode-self"
              className={`min-h-9 px-3 py-1.5 rounded-full ${!adelMode ? "bg-navy text-navy-foreground" : "text-foreground/60"}`}
            >
              {W.toggleSelf}
            </button>
            <button
              onClick={() => {
                setStep(0);
                setAdelMode(true);
              }}
              aria-pressed={adelMode}
              data-testid="intake-mode-adel"
              className={`min-h-9 px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${adelMode ? "bg-navy text-navy-foreground" : "text-foreground/60"}`}
            >
              <Sparkles className="h-3 w-3" /> {W.toggleAdel}
            </button>
          </div>
          )}
        </div>
        {/* §Onboarding rework — one-tap 988 on every step (replaces the
            staff-only "Flag crisis now" button). */}
        <Slim988Bar className="mb-3" />
        {!inReassess && (<>
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
        </>)}
      </header>

      {inReassess && (
        <Card className="p-6 space-y-5" data-testid="reassess-flow">
          {reassess === "ask" && (
            <div className="space-y-4" data-testid="reassess-ask">
              <p className="text-lg text-foreground">{R.question}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="min-h-11" data-testid="reassess-changed-yes" onClick={() => setReassess("about")}>
                  {R.yes}
                </Button>
                <Button variant="outline" className="min-h-11" data-testid="reassess-changed-no" onClick={() => setReassess("due")}>
                  {R.no}
                </Button>
              </div>
            </div>
          )}
          {reassess === "about" && (
            <div className="space-y-5">
              {aboutSection}
              <div className="flex justify-between gap-3">
                <Button variant="outline" className="min-h-11" onClick={() => setReassess("ask")}>
                  Back
                </Button>
                <Button
                  className="min-h-11 bg-navy text-navy-foreground hover:bg-navy/90"
                  data-testid="reassess-save-about"
                  onClick={() => {
                    AdelanteEHR.updateProfile(currentId, profilePatch(profile));
                    toast.success(R.saved);
                    setReassess("due");
                  }}
                >
                  {R.saveContinue}
                </Button>
              </div>
            </div>
          )}
          {reassess === "due" && (
            <div className="space-y-4" data-testid="reassess-due">
              {due.length > 0 ? (
                <>
                  <p className="text-foreground">{R.dueLede}</p>
                  <ul className="space-y-2">
                    {due.map((d) => (
                      <li key={d.key} className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm">
                        <span className="flex-1">{rescreenName(d.key, lang9a === "es" ? "es" : "en")}</span>
                        <Button asChild size="sm">
                          <Link to="/rescreen/$key" params={{ key: d.key }} data-testid={`reassess-due-start-${d.key}`}>
                            {R.start}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-foreground" data-testid="reassess-nothing-due">{R.nothingDue}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/home">{R.backHome}</Link>
                </Button>
                <Button variant="ghost" className="min-h-11" data-testid="reassess-full" onClick={() => { setStep(0); setReassess("full"); }}>
                  {R.full}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
      {!inReassess && (<>
      <Card className="p-6">
        {current.key === "welcome" && adelMode && (
          <AdelGuidedIntake
            patientId={currentId}
            profile={profile}
            benefits={benefits}
            onProfile={setProfile}
            onBenefits={onBenefitsChange}
            consentOnFile={Boolean(consentOnFile)}
            onExit={() => setAdelMode(false)}
            onHandoff={() => {
              setAdelMode(false);
              const target = steps.findIndex((s) => s.key === (consentOnFile ? "coverage" : "consent"));
              if (target >= 0) setStep(target);
            }}
          />
        )}
        {current.key === "welcome" && !adelMode && (
          <div className="space-y-5" data-testid="intake-welcome">
            <p className="text-lg text-foreground">{W.lede}</p>
            <ul className="space-y-3 text-base">
              <li className="flex gap-3">
                <Clock className="h-5 w-5 text-teal mt-0.5 shrink-0" aria-hidden="true" />
                <span>{W.time}</span>
              </li>
              <li className="flex gap-3">
                <Lock className="h-5 w-5 text-teal mt-0.5 shrink-0" aria-hidden="true" />
                <span>{W.privacy}</span>
              </li>
            </ul>
            <div>
              <h2 className="font-medium text-navy">{W.choiceTitle}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={next}
                  data-testid="intake-start-self"
                  className="rounded-xl border-2 bg-card p-4 text-left transition-colors hover:border-teal focus-visible:border-teal"
                >
                  <ClipboardList className="h-5 w-5 text-teal" aria-hidden="true" />
                  <div className="mt-2 font-semibold text-navy">{W.selfTitle}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{W.selfBody}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAdelMode(true)}
                  data-testid="intake-start-with-adel"
                  className="rounded-xl border-2 bg-card p-4 text-left transition-colors hover:border-teal focus-visible:border-teal"
                >
                  <Sparkles className="h-5 w-5 text-teal" aria-hidden="true" />
                  <div className="mt-2 font-semibold text-navy">{W.adelTitle}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{W.adelBody}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ADEL_COPY[lang9a === "es" ? "es" : "en"].banner}
                  </p>
                </button>
              </div>
            </div>
            <AskAdelHelp className="text-sm text-foreground" />
          </div>
        )}

        {current.key === "about" && aboutSection}

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

            <BenefitsStep value={benefits} onChange={onBenefitsChange} patientId={currentId} audience="self" />

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
            />

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
                <ScreenerItems
                  def={s}
                  answers={answers[s.key] ?? []}
                  choices={choices[s.key]}
                  onChange={(next, ch) => {
                    setAnswers({ ...answers, [s.key]: next as number[] });
                    setChoices({ ...choices, [s.key]: ch });
                  }}
                />
              </div>
            ),
        )}

        {current.key === "needs" && (
          <div className="space-y-6" data-testid="needs-step">
            <h2 className="font-display text-xl text-navy">{H.title}</h2>
            {langKey === "es" && H.esPending && (
              <p className="text-xs text-muted-foreground" data-testid="needs-es-pending">{H.esPending}</p>
            )}

            {/* Section A — care you're looking for (existing question + "Not sure yet"). */}
            {!inReassess && (
              <fieldset className="space-y-2 rounded-lg border p-4" data-testid="seeking-question">
                <legend className="px-1 text-sm font-medium text-navy">{H.sectionA}</legend>
                <p className="text-sm">{B.seekingQ}</p>
                {(["mentalHealth", "medication", "substanceUse"] as const).map((k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
                    <Checkbox
                      checked={seeking[k]}
                      data-testid={`seeking-${k}`}
                      onCheckedChange={(v) => setSeeking({ ...seeking, [k]: Boolean(v), notSure: false })}
                    />
                    <span>{B.seeking[k]}</span>
                  </label>
                ))}
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
                  <Checkbox
                    checked={seeking.notSure}
                    data-testid="seeking-notSure"
                    onCheckedChange={(v) =>
                      setSeeking(
                        v
                          ? { mentalHealth: false, medication: false, substanceUse: false, notSure: true }
                          : { ...seeking, notSure: false },
                      )
                    }
                  />
                  <span>{H.notSure}</span>
                </label>
                <p className="text-xs text-muted-foreground">{B.seekingNote}</p>
              </fieldset>
            )}

            {/* Section B — everyday needs. */}
            <section className="space-y-4 rounded-lg border p-4" data-testid="everyday-needs">
              <h3 className="text-sm font-medium text-navy">{H.sectionB}</h3>

              {skipCore && (
                <div className="space-y-3 rounded-lg border bg-secondary/40 p-3" data-testid="needs-already-knows">
                  <div className="text-sm font-medium">{H.alreadyKnows}</div>
                  {(() => {
                    const names = new Map<string, string>();
                    for (const r of needsPlan.known) names.set(r.need.toLowerCase(), `${r.need} — ${provenanceFor(r.source)}`);
                    for (const i of outsideNeeds) {
                      const label = patientSafeNeedLabel(i);
                      if (label && !names.has(label.toLowerCase())) names.set(label.toLowerCase(), `${label} — ${provenanceFor(i.source)}`);
                    }
                    for (const d of needsPlan.onFileOnly) {
                      if (d.domainKey === "safety") continue;
                      if (!names.has(d.domainLabel.toLowerCase())) names.set(d.domainLabel.toLowerCase(), d.domainLabel);
                    }
                    const hiddenSafety =
                      outsideNeeds.some((i) => !patientSafeNeedLabel(i)) ||
                      needsPlan.onFileOnly.some((d) => d.domainKey === "safety");
                    return (
                      <ul className="space-y-1 text-sm">
                        {[...names.values()].map((n) => (
                          <li key={n} data-testid="needs-already-knows-item">• {n}</li>
                        ))}
                        {hiddenSafety && <li className="text-muted-foreground">• {H.otherPrivate}</li>}
                      </ul>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">{H.alreadyKnowsNote}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-11"
                      variant={coreChoice === "confirm" ? "default" : "outline"}
                      data-testid="needs-already-confirm"
                      onClick={() => {
                        setCoreChoice("confirm");
                        setKnownAnswers(Object.fromEntries(needsPlan.known.map((r) => [r.intakeKey, "yes"])));
                      }}
                    >
                      {H.confirm}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-11"
                      variant={coreChoice === "update" ? "default" : "outline"}
                      data-testid="needs-already-update"
                      onClick={() => {
                        setCoreChoice("update");
                        setKnownAnswers(Object.fromEntries(needsPlan.known.map((r) => [r.intakeKey, "yes"])));
                      }}
                    >
                      {H.update}
                    </Button>
                  </div>
                  {coreChoice === "update" && <p className="text-xs text-muted-foreground">{H.updateNote}</p>}
                </div>
              )}

              {askCore && hrsnDef && (
                <div className="space-y-3" data-testid="needs-core-questions">
                  <div>
                    <Badge variant="outline" className="border-teal/40 text-teal">{hrsnDef.name}</Badge>
                    <p className="mt-2 text-xs text-muted-foreground">{H.coreIntro}</p>
                  </div>
                  <ScreenerItems
                    def={hrsnDef}
                    answers={answers["ahc-hrsn"] ?? []}
                    choices={choices["ahc-hrsn"]}
                    onChange={(nextA, ch) => {
                      setAnswers({ ...answers, "ahc-hrsn": nextA as number[] });
                      setChoices({ ...choices, "ahc-hrsn": ch });
                    }}
                  />
                </div>
              )}

              {/* Staff- or advocate-identified needs still get "still applies?" when the core is asked. */}
              {!skipCore && needsPlan.known.length > 0 && (
                <div className="space-y-2" data-testid="needs-known">
                  {needsPlan.known.map((row) => (
                    <div key={row.intakeKey} className="flex flex-wrap items-center gap-2 rounded-lg border p-3" data-testid={`needs-known-${row.intakeKey}`}>
                      <span className="text-sm font-medium">{row.need}</span>
                      <Badge variant="outline" className="text-[10px]">{SDOH_SOURCE_LABEL[row.source]}</Badge>
                      <Button type="button" size="sm" variant={knownAnswers[row.intakeKey] === "yes" ? "default" : "outline"} data-testid={`needs-known-${row.intakeKey}-yes`} onClick={() => setKnownAnswers((s) => ({ ...s, [row.intakeKey]: "yes" }))}>{H.confirm}</Button>
                      <Button type="button" size="sm" variant={knownAnswers[row.intakeKey] === "no" ? "default" : "outline"} data-testid={`needs-known-${row.intakeKey}-no`} onClick={() => setKnownAnswers((s) => ({ ...s, [row.intakeKey]: "no" }))}>{H.update}</Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional topics — directory categories the core does not cover. */}
              <div className="space-y-2" data-testid="needs-optional-topics">
                <p className="text-sm">{H.topicsQ}</p>
                <p className="text-[11px] text-muted-foreground">{H.draft}</p>
                {OPTIONAL_TOPICS.map((t) => {
                  const on = topics[t.key] !== undefined;
                  return (
                    <div key={t.key} className="rounded-md border p-3">
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                        <Checkbox
                          checked={on}
                          data-testid={`topic-${t.key}`}
                          onCheckedChange={(v) => {
                            const nextT = { ...topics };
                            if (v) nextT[t.key] = "";
                            else delete nextT[t.key];
                            setTopics(nextT);
                          }}
                        />
                        <span>{t[langKey]}</span>
                      </label>
                      {on && (
                        <div className="mt-2 space-y-1 pl-7">
                          <div className="text-xs text-muted-foreground">{H.howSoon}</div>
                          <div className="flex flex-wrap gap-2" role="group" aria-label={H.howSoon}>
                            {URGENCIES.map((u) => (
                              <Button
                                key={u}
                                type="button"
                                size="sm"
                                className="min-h-11"
                                variant={topics[t.key] === u ? "default" : "outline"}
                                data-testid={`topic-${t.key}-${u}`}
                                onClick={() => setTopics({ ...topics, [t.key]: u })}
                              >
                                {URGENCY_LABEL[langKey][u]}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <IntakeMatchPreview
                categoryIds={[
                  ...OPTIONAL_TOPICS.filter((t) => topics[t.key] !== undefined).map((t) => t.categoryId),
                ]}
                lang={langKey}
              />
            </section>
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
                const raw = answers[s.key] ?? [];
                const { score, severity } = scoreScreener(
                  s,
                  s.questions.map((_, i) => (typeof raw[i] === "number" ? raw[i] : 0)),
                );
                return (
                  <div key={s.key} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-medium text-navy">
                      {score} · {severity}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2 border-t">
                <span>Needs flagged</span>
                <span className="font-medium text-navy">
                  {needsPlan.capture.filter((k) => needs[k]).length +
                    needsPlan.known.filter((r) => knownAnswers[r.intakeKey] === "yes").length}{" "}
                  of {needsPlan.capture.length + needsPlan.known.length}
                </span>
              </div>
              {needsPlan.onFileOnly.length > 0 && (
                <div className="flex justify-between">
                  <span>Also on file from screening</span>
                  <span className="font-medium text-navy">{needsPlan.onFileOnly.length}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Spacer so the fixed mobile action bar doesn't cover content */}
      {/* Sits ABOVE the patient tab bar (fixed, md:hidden) — it used to sit
          under it on phones, so "Save & continue" couldn't be tapped. */}
      {!adelMode && (<>
      <div className="h-60 md:hidden" aria-hidden />
      <div className={`fixed md:sticky ${alreadyComplete ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]" : "bottom-[env(safe-area-inset-bottom)]"} md:bottom-0 left-0 right-0 md:left-auto md:right-auto z-30 mt-5 flex justify-between gap-3 bg-background/95 backdrop-blur border-t md:border-0 md:bg-transparent px-4 md:px-0 py-3 md:py-0`}>
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
      </>)}
      </>)}
    </div>
  );
}
