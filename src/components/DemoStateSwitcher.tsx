// §QA 5-state pass — the demo scenario switcher.
//
// One control, always reachable: it used to live in the page footer, which is
// below the fold on any constrained viewport, so a reviewer could not reach it
// without scrolling past the whole surface. It is now fixed to the top of the
// viewport and never scrolls away.
//
// It is a DEMO control. Every state it sets up is produced through the real
// APIs (`setCurrentPatientId`, `createAdvocateInvitation`,
// `claimAdvocateInvitation`) — nothing here writes store internals or invents
// a parallel session mechanism.
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
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

/** The five states the QA pass is written against. */
type DemoStateId =
  | "no_record"
  | "ji_post_release"
  | "general_population"
  | "advocate"
  | "advocate_and_patient";

const STATE_LABEL: Record<DemoStateId, { label: string; hint: string }> = {
  no_record: {
    label: "Front door / no record",
    hint: "State 1 — nobody signed in, no patient record yet",
  },
  ji_post_release: {
    label: "Daniel M. — Justice-Involved, Post-Release",
    hint: "State 2 — completed intake, JI reentry flag, pre-release journey",
  },
  advocate: {
    label: "Advocate view (invite-code session)",
    hint: "State 3 — external advocate for Daniel M., no patient session",
  },
  advocate_and_patient: {
    label: "Advocate + own patient record",
    hint: "State 4 — Alicia S. is a patient AND advocate for Daniel M.",
  },
  general_population: {
    label: "Alicia S. — General Population",
    hint: "State 5 — completed intake, no justice signal anywhere",
  },
};

const ORDER: DemoStateId[] = [
  "no_record",
  "ji_post_release",
  "advocate",
  "advocate_and_patient",
  "general_population",
];

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
  if (existing) return existing.id;
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
  return claimed.id;
}

export function DemoStateSwitcher() {
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const [advocateLinkId, setAdvocateLinkId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setAdvocateLinkId(localStorage.getItem(ADVOCATE_SESSION_KEY));
    } catch {
      setAdvocateLinkId(null);
    }
  }, [currentId]);

  const active: DemoStateId | null = (() => {
    if (advocateLinkId) return patient ? "advocate_and_patient" : "advocate";
    if (!patient) return "no_record";
    if (patient.id === "p1") return "ji_post_release";
    if (patient.id === "p4") return "general_population";
    return null;
  })();

  function apply(state: DemoStateId) {
    try {
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
          navigate({ to: "/patient" });
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
      toast.success(STATE_LABEL[state].label, { description: STATE_LABEL[state].hint });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch demo state.");
    }
  }

  return (
    <div className="fixed top-16 right-3 z-[70] print:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="demo-state-switcher" className="inline-flex items-center gap-1.5 rounded-full border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground/80 shadow-sm backdrop-blur hover:bg-secondary">
          <FlaskConical className="h-3.5 w-3.5 text-teal" />
          <span className="max-w-[9rem] truncate">
            {active ? STATE_LABEL[active].label : `Demo · ${patient?.firstName ?? "no record"}`}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Demo scenarios · the five QA states
          </DropdownMenuLabel>
          {ORDER.map((id) => (
            <DropdownMenuItem
              key={id}
              onClick={() => apply(id)}
              className={cn("flex-col items-start gap-0.5", active === id && "bg-secondary")}
            >
              <span className="text-sm font-medium">{STATE_LABEL[id].label}</span>
              <span className="text-[11px] text-muted-foreground">{STATE_LABEL[id].hint}</span>
            </DropdownMenuItem>
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
                  AdelanteEHR.setCurrentPatientId(p.id);
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
