// §QA 5-state pass — the demo scenario switcher.
//
// One control, always reachable: it used to live in the page footer, which is
// below the fold on any constrained viewport, so a reviewer could not reach it
// without scrolling past the whole surface. It is now fixed to the top of the
// viewport and never scrolls away with the shared sticky demo bar.
//
// It is a DEMO control. Every state it sets up is produced through the real
// APIs (`setCurrentPatientId`, `createAdvocateInvitation`,
// `claimAdvocateInvitation`) — nothing here writes store internals or invents
// a parallel session mechanism.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AdelanteEHR,
  useEhr,
  COLLATERAL_ROI_CATEGORY,
  DEMO_PRE_RELEASE_PERSONA,
  DEMO_SCENARIO_PERSONAS,
  demoScenarioPatientId,
} from "@/lib/ehr";
import { setActingRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FlaskConical } from "lucide-react";

const ADVOCATE_SESSION_KEY = "adelante.advocateLinkId";
const ACTIVE_DEMO_STATE_KEY = "adelante.activeDemoState";

/** QA scenario matrix (Part B). Patient scenarios resolve to real records. */
type ScenarioKey = keyof typeof DEMO_SCENARIO_PERSONAS;
type DemoStateId =
  | "no_record"
  | "mh_only"
  | "medication"
  | "sud_consented"
  | "combination"
  | "ji_self_report"
  | "sud_no_consent"
  | "pre_release"
  | "public_referral"
  | "advocate"
  | "advocate_and_patient"
  | "ji_post_release"
  | "general_population"
  | "rosa"
  | "marcus"
  | "kayla";

const STATE_LABEL: Record<DemoStateId, { label: string; hint: string; group: string }> = {
  no_record: {
    group: "Sign-up",
    label: "1 · New sign-up, no record",
    hint: "Front door for the general population — nobody signed in, no record yet",
  },
  mh_only: {
    group: "Intake by need",
    label: "2a · Elena V. — Mental health only",
    hint: "Intake done: PHQ-9, GAD-7, PC-PTSD-5, AHC-HRSN. No substance-use tools or Recovery Journey",
  },
  medication: {
    group: "Intake by need",
    label: "2b · Paloma O. — Medication management",
    hint: "Intake done, suggested prescriber goal awaiting clinician; no substance-use tools",
  },
  sud_consented: {
    group: "Intake by need",
    label: "2c · Luis C. — Substance use (Part 2 consent)",
    hint: "Adds AUDIT + DAST-10 (Part 2-masked). Recovery Journey, craving and meetings shown",
  },
  combination: {
    group: "Intake by need",
    label: "2d · Jasmine H. — Combination",
    hint: "Mental health + medication + substance use with consent; all screeners and SUD tools",
  },
  ji_self_report: {
    group: "Justice",
    label: "3 · Victor H. — Previously justice-involved (self-reported)",
    hint: "Self-reported at intake, not referred; reentry content, no Recovery Journey",
  },
  sud_no_consent: {
    group: "Intake by need",
    label: "7 · Jordan V. — Substance use, no Part 2 consent",
    hint: "Answer kept; masked ASAM task for clinical staff only; no SUD tools on the patient's own screens",
  },
  pre_release: {
    group: "Justice",
    label: "4 · Tomás R. — Pre-release referred",
    hint: "Pre-populated record, partner-reported needs, live enrollment code, intake not started",
  },
  public_referral: {
    group: "Referral",
    label: "5 · Carmen I. — Public referral form",
    hint: "Referral → outreach logged → enrolled → claim code; opens the referral queue as staff",
  },
  advocate: {
    group: "Advocates",
    label: "6a · Advocate only",
    hint: "External advocate for Daniel M. (invite code + signed ROI), no patient record",
  },
  advocate_and_patient: {
    group: "Advocates",
    label: "6b · Advocate who is also a patient",
    hint: "Alicia S. advocates for Daniel M. and has her own record (Support for myself)",
  },
  ji_post_release: {
    group: "Existing demo records",
    label: "Daniel M. — Post-release, CalOMS",
    hint: "EHR: intake done, CalOMS SUD history, PHQ-9/GAD-7 re-screens due day 90",
  },
  general_population: {
    group: "Existing demo records",
    label: "Alicia S. — General population",
    hint: "EHR: intake done, no justice or substance-use signal; naloxone and 988 still shown",
  },
  rosa: {
    group: "Existing demo records",
    label: "Rosa T. — Form intake not started",
    hint: "EHR: record exists, intake incomplete — walks the full form intake",
  },
  marcus: {
    group: "Existing demo records",
    label: "Marcus — Legacy AUDIT result",
    hint: "EHR: AUDIT 16 labelled 'Scored before 0/2/4 fix', PHQ-9 re-screen due day 90",
  },
  kayla: {
    group: "Existing demo records",
    label: "Kayla's trainee visit (staff)",
    hint: "Opens the cosign inbox: trainee note → supervisor cosign → signed claim on Billing",
  },
};

const ORDER: DemoStateId[] = [
  "no_record",
  "mh_only",
  "medication",
  "sud_consented",
  "combination",
  "ji_self_report",
  "sud_no_consent",
  "pre_release",
  "public_referral",
  "advocate",
  "advocate_and_patient",
  "ji_post_release",
  "general_population",
  "rosa",
  "marcus",
  "kayla",
];

const SCENARIO_KEYS: ScenarioKey[] = ["mh_only", "medication", "sud_consented", "combination", "ji_self_report", "sud_no_consent"];

function preReleasePersonaId(): string | undefined {
  return AdelanteEHR.listPatients().find(
    (p) =>
      p.firstName === DEMO_PRE_RELEASE_PERSONA.firstName &&
      p.lastName === DEMO_PRE_RELEASE_PERSONA.lastName,
  )?.id;
}

function clearPatientSession() {
  try {
    localStorage.removeItem("adelante.session");
    sessionStorage.removeItem("adelante.session");
    localStorage.removeItem("adelante.currentPatientId");
  } catch {
    /* storage unavailable */
  }
}

function clearAdvocateSession() {
  try {
    localStorage.removeItem(ADVOCATE_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Reuse an already-claimed link for this advocate name if one exists,
 * otherwise run the real invite → claim pair. The self-referential guard in
 * `claimAdvocateInvitation` still applies, so the acting patient is cleared
 * before claiming a link written for someone else.
 */
function ensureAdvocateLinkId(patientId: string, advocateName: string): string {
  const existing = AdelanteEHR.listAdvocateLinks(patientId).find(
    (l) => l.advocateName === advocateName && l.status === "active",
  );
  if (existing) {
    ensureCollateralRoi(patientId);
    return existing.id;
  }
  const invite = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName,
    relationship: "Family",
    invitationSentTo: "advocate@example.com",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Demo setup" },
  });
  const claimed = AdelanteEHR.claimAdvocateInvitation({
    code: invite.invitationCode,
    authorizationType: "family_participation",
    attestedName: advocateName,
  });
  ensureCollateralRoi(patientId);
  return claimed.id;
}

/**
 * §Advocate Build 2 — the demo advocate is a `family_participation` link, which
 * by design grants ZERO access until the patient signs a collateral ROI. Sign a
 * real ConsentRecord (the same store path the consent tab uses) so the demo
 * shows effective access rather than a permanent pending state. Any categories
 * already authorized are carried forward so nothing is silently withdrawn.
 */
function ensureCollateralRoi(patientId: string): void {
  if (AdelanteEHR.isConsentCategoryAuthorized(patientId, COLLATERAL_ROI_CATEGORY)) return;
  const prior = AdelanteEHR.activeConsentRecord(patientId);
  const sections = [
    ...(prior?.sections ?? []).filter((s) => s.category !== COLLATERAL_ROI_CATEGORY),
    { category: COLLATERAL_ROI_CATEGORY, authorized: true },
  ];
  AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "Demo setup — advocate scenario",
    signedByName: "Demo Patient",
    relationship: "patient",
    attested: true,
    effectiveDate: new Date().toISOString().slice(0, 10),
    sections,
    capturedBy: { staffName: "Demo setup", role: "cf_care_manager" },
    ...(prior ? { supersedesId: prior.id } : {}),
  });
}

export function DemoStateSwitcher() {
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const [advocateLinkId, setAdvocateLinkId] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<DemoStateId | null>(null);
  useEffect(() => {
    try {
      setAdvocateLinkId(localStorage.getItem(ADVOCATE_SESSION_KEY));
      const stored = sessionStorage.getItem(ACTIVE_DEMO_STATE_KEY);
      setSelectedState(ORDER.includes(stored as DemoStateId) ? (stored as DemoStateId) : null);
    } catch {
      setAdvocateLinkId(null);
      setSelectedState(null);
    }
  }, [currentId]);

  const inferredActive: DemoStateId | null = (() => {
    if (advocateLinkId) return patient ? "advocate_and_patient" : "advocate";
    if (!patient) return "no_record";
    if (patient.id === "p1") return "ji_post_release";
    if (patient.id === "p4") return "general_population";
    if (patient.id === "p2") return "rosa";
    if (patient.id === "p3") return "marcus";
    if (patient.id === preReleasePersonaId()) return "pre_release";
    for (const k of [...SCENARIO_KEYS, "public_referral" as const])
      if (patient.id === demoScenarioPatientId(k)) return k;
    return null;
  })();
  const active = selectedState === inferredActive ? selectedState : null;

  function apply(state: DemoStateId) {
    try {
      sessionStorage.setItem(ACTIVE_DEMO_STATE_KEY, state);
      setSelectedState(state);
      const willUseAdvocateSession = state === "advocate" || state === "advocate_and_patient";
      if (!willUseAdvocateSession) {
        clearAdvocateSession();
        setAdvocateLinkId(null);
        window.dispatchEvent(new Event("adelante:advocate-session"));
      }
      switch (state) {
        case "no_record": {
          clearAdvocateSession();
          clearPatientSession();
          AdelanteEHR.setCurrentPatientId("");
          setAdvocateLinkId(null);
          navigate({ to: "/start" });
          break;
        }
        case "ji_post_release":
        case "general_population": {
          clearAdvocateSession();
          setAdvocateLinkId(null);
          AdelanteEHR.setCurrentPatientId(state === "ji_post_release" ? "p1" : "p4");
          navigate({ to: "/home" });
          break;
        }
        case "mh_only":
        case "medication":
        case "sud_consented":
        case "combination":
        case "ji_self_report":
        case "rosa":
        case "marcus": {
          const id =
            state === "rosa" ? "p2" : state === "marcus" ? "p3" : demoScenarioPatientId(state);
          if (!id) throw new Error("That demo patient is not available.");
          clearAdvocateSession();
          setAdvocateLinkId(null);
          AdelanteEHR.setCurrentPatientId(id);
          navigate({ to: id === "p2" ? "/intake" : "/home" });
          break;
        }
        case "public_referral": {
          clearAdvocateSession();
          setAdvocateLinkId(null);
          const id = demoScenarioPatientId("public_referral");
          if (id) AdelanteEHR.setCurrentPatientId(id);
          setActingRole("cf_care_manager");
          navigate({ to: "/referral-queue" });
          break;
        }
        case "kayla": {
          clearAdvocateSession();
          setAdvocateLinkId(null);
          navigate({ to: "/cosign-inbox" });
          break;
        }
        case "pre_release": {
          const id = preReleasePersonaId();
          if (!id) throw new Error("Pre-release demo patient is not available.");
          clearAdvocateSession();
          setAdvocateLinkId(null);
          AdelanteEHR.setCurrentPatientId(id);
          navigate({ to: "/intake" });
          break;
        }
        case "advocate": {
          // No patient session at all: a pure external advocate.
          clearPatientSession();
          AdelanteEHR.setCurrentPatientId("");
          const id = ensureAdvocateLinkId("p1", "Rosa T. (advocate)");
          localStorage.setItem(ADVOCATE_SESSION_KEY, id);
          setAdvocateLinkId(id);
          navigate({ to: "/advocate" });
          break;
        }
        case "advocate_and_patient": {
          // Dual role, done the only way it is legitimate: Alicia has her own
          // record AND advocates for a DIFFERENT person (Daniel). The claim
          // runs with no patient session, then her own record is restored.
          AdelanteEHR.setCurrentPatientId("");
          const id = ensureAdvocateLinkId("p1", "Alicia S. (advocate)");
          localStorage.setItem(ADVOCATE_SESSION_KEY, id);
          setAdvocateLinkId(id);
          AdelanteEHR.setCurrentPatientId("p4");
          navigate({ to: "/advocate" });
          break;
        }
      }
      // The advocate shell reads its session from localStorage on mount, so a
      // switch made while that shell is already mounted has to announce itself.
      window.dispatchEvent(new Event("adelante:advocate-session"));
      toast.success(STATE_LABEL[state].label, { description: STATE_LABEL[state].hint });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch demo state.");
    }
  }

  return (
    <div className="min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="demo-state-switcher"
          aria-label="Demo control: QA scenario"
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur hover:bg-secondary"
        >
          <FlaskConical className="h-3.5 w-3.5 text-teal" />
          <span className="max-w-[7.5rem] truncate sm:max-w-[14rem]">
            <span className="text-muted-foreground">QA: </span>
            {active ? STATE_LABEL[active].label.split(" — ")[0] : "choose a scenario"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-[75vh] overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Demo scenarios · QA states
          </DropdownMenuLabel>
          {ORDER.map((id, i) => (
            <div key={id}>
            {(i === 0 || STATE_LABEL[ORDER[i - 1]!].group !== STATE_LABEL[id].group) && (
              <div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {STATE_LABEL[id].group}
              </div>
            )}
            <DropdownMenuItem
              key={id}
              onClick={() => apply(id)}
              className={cn("flex-col items-start gap-0.5", active === id && "bg-secondary")}
            >
              <span className="text-sm font-medium">{STATE_LABEL[id].label}</span>
              <span className="text-[11px] text-muted-foreground">{STATE_LABEL[id].hint}</span>
            </DropdownMenuItem>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Any patient record
          </DropdownMenuLabel>
          <div className="max-h-56 overflow-y-auto">
            {AdelanteEHR.listPatients().map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => {
                  clearAdvocateSession();
                  setAdvocateLinkId(null);
                   sessionStorage.removeItem(ACTIVE_DEMO_STATE_KEY);
                   setSelectedState(null);
                  AdelanteEHR.setCurrentPatientId(p.id);
                   navigate({ to: p.intakeCompletedAt ? "/home" : "/intake" });
                }}
                className={cn("text-sm", currentId === p.id && !advocateLinkId && "bg-secondary")}
              >
                <span className="flex-1">
                  {p.firstName} {p.lastName}
                </span>
                <span
                  className={cn(
                    "text-[10px] rounded-full px-1.5 py-0.5",
                    p.intakeCompletedAt ? "bg-teal/15 text-teal" : "bg-gold/20 text-navy",
                  )}
                >
                  {p.intakeCompletedAt ? "intake ✓" : "new"}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
