import { AdelanteEHR, useEhr, type CarePlanSnapshot } from "@/lib/ehr";
import { useActingRole, canAccess, type StaffRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClientDate } from "@/components/ClientDate";
import {
  HeartPulse,
  Target,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Audience = "patient" | "clinician" | "case_manager";

/**
 * Unified care-plan renderer. Reads the auto-derived `CarePlanSnapshot`
 * from `AdelanteEHR` and gates sensitive slices (SUD, meds) using the
 * acting staff role + patient consent. Patient audience ignores role
 * (patients see their own data by default) but still respects the
 * snapshot's own `sensitive` flags for plain-language wording.
 */
export function CarePlanCard({
  patientId,
  audience,
  className,
  compact = false,
}: {
  patientId: string;
  audience: Audience;
  className?: string;
  compact?: boolean;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const plan = useEhr(() => AdelanteEHR.getCarePlan(patientId));
  const [role] = useActingRole();

  if (!patient) return null;

  // Determine what SUD material this viewer may see.
  const staffRole: StaffRole | null = audience === "patient" ? null : role;
  const sudUnlocked =
    audience === "patient"
      ? true
      : staffRole
        ? !canAccess(staffRole, "sud_treatment", patient).locked
        : false;
  const medsUnlocked =
    audience === "patient"
      ? true
      : staffRole
        ? !canAccess(staffRole, "meds_erx", patient).locked
        : false;

  if (!plan) {
    return (
      <Card className={cn("p-5", className)}>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
          <HeartPulse className="h-4 w-4" /> Care plan
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {patient.intakeCompletedAt
            ? "Care plan will appear here shortly."
            : "Finish intake to see your care plan."}
        </p>
      </Card>
    );
  }

  const filteredFocus = plan.focusAreas.filter((f) => (f.sensitive ? sudUnlocked : true));
  const filteredNext = plan.nextSteps.filter((s) => (s.sensitive ? sudUnlocked : true));
  const filteredScreeners = plan.screenerHighlights.filter((s) =>
    s.sensitive ? sudUnlocked : true,
  );
  const filteredMeds = medsUnlocked ? plan.medications : [];
  const hasHiddenSud = plan.focusAreas.some((f) => f.sensitive) && !sudUnlocked;
  const hasHiddenMeds = plan.medications.length > 0 && !medsUnlocked;

  const goalsPct = plan.metrics.goalsOpen + plan.metrics.goalsDone
    ? Math.round(
        (plan.metrics.goalsDone / (plan.metrics.goalsOpen + plan.metrics.goalsDone)) * 100,
      )
    : 0;

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
          <HeartPulse className="h-4 w-4" /> Care plan
          {audience !== "patient" && (
            <Badge variant="outline" className="ml-1 text-[10px] gap-1">
              <Sparkles className="h-3 w-3" /> auto-updated
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Updated <ClientDate iso={plan.updatedAt} /> · {plan.updatedBy.replace("_", " ")}
        </div>
      </div>

      {plan.metrics.crisisFlag && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          <ShieldAlert className="h-4 w-4 mt-0.5" />
          <span>Safety flag raised recently — follow up per protocol.</span>
        </div>
      )}

      <p className="mt-3 whitespace-pre-line text-sm text-foreground">{plan.summary}</p>

      {filteredFocus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filteredFocus.map((f) => (
            <Badge key={`${f.key}-${f.label}`} variant="outline" className="gap-1 text-xs">
              {f.label}
              {f.severity && (
                <span className="text-[10px] text-muted-foreground">· {f.severity}</span>
              )}
            </Badge>
          ))}
        </div>
      )}

      {(hasHiddenSud || hasHiddenMeds) && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 mt-0.5" />
          <span>
            {hasHiddenSud && "Substance-use details are hidden — 42 CFR Part 2 consent required. "}
            {hasHiddenMeds && "Medication details are restricted for your role."}
          </span>
        </div>
      )}

      {!compact && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-navy">
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Goals
              </span>
              <span className="text-[10px] text-muted-foreground">
                {plan.metrics.goalsDone}/{plan.metrics.goalsDone + plan.metrics.goalsOpen} done
              </span>
            </div>
            <Progress value={goalsPct} className="mt-2 h-1.5" />
            <ul className="mt-2 space-y-1">
              {plan.activeGoals.slice(0, 3).map((g) => (
                <li key={g.id} className="text-xs text-foreground">
                  • {g.text}
                </li>
              ))}
              {plan.activeGoals.length === 0 && (
                <li className="text-xs text-muted-foreground">No open goals right now.</li>
              )}
            </ul>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-navy inline-flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> Next steps
            </div>
            <ul className="mt-2 space-y-1">
              {filteredNext.slice(0, 4).map((s, i) => (
                <li key={i} className="text-xs text-foreground">
                  • {s.label}
                  {s.dueBy && (
                    <span className="text-muted-foreground">
                      {" "}
                      · <ClientDate iso={s.dueBy} />
                    </span>
                  )}
                </li>
              ))}
              {filteredNext.length === 0 && (
                <li className="text-xs text-muted-foreground">Nothing pending — great work.</li>
              )}
            </ul>
          </div>

          {audience !== "patient" && filteredScreeners.length > 0 && (
            <div className="sm:col-span-2">
              <div className="text-xs font-medium uppercase tracking-wider text-navy">
                Latest screeners
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {filteredScreeners.map((s) => (
                  <Badge key={s.key} variant="secondary" className="text-[10px]">
                    {s.name}: {s.score} · {s.band}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {audience !== "patient" && filteredMeds.length > 0 && (
            <div className="sm:col-span-2">
              <div className="text-xs font-medium uppercase tracking-wider text-navy">
                Medications
              </div>
              <ul className="mt-2 space-y-1">
                {filteredMeds.map((m, i) => (
                  <li key={i} className="text-xs text-foreground inline-flex items-center gap-2">
                    {m.name}
                    <Badge variant="outline" className="text-[10px]">
                      {m.state.replace("_", " ")}
                    </Badge>
                    {m.sensitive && (
                      <span className="text-[10px] text-muted-foreground">Part 2</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Admin-facing de-identified strip. Aggregates across all patients; no PHI.
 */
export function PopulationCarePlanStrip({ className }: { className?: string }) {
  const m = useEhr(() => AdelanteEHR.getPopulationCarePlanMetrics());
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-teal inline-flex items-center gap-1.5">
          <HeartPulse className="h-4 w-4" /> Population care plan
        </div>
        <Badge variant="outline" className="text-[10px]">De-identified</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Plans" value={`${m.withPlan}/${m.patients}`} />
        <Stat label="Intake complete" value={String(m.intakeComplete)} />
        <Stat label="Open goals" value={String(m.goalsOpen)} />
        <Stat label="Open life needs" value={String(m.sdohOpen)} />
        <Stat label="Avg PHQ-9" value={m.avgPhq9 !== undefined ? String(m.avgPhq9) : "—"} />
        <Stat label="Avg GAD-7" value={m.avgGad7 !== undefined ? String(m.avgGad7) : "—"} />
        <Stat label="Crisis flags" value={String(m.crisisFlags)} />
        <Stat label="Part 2 meds" value={String(m.medsSensitive)} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl text-navy">{value}</div>
    </div>
  );
}