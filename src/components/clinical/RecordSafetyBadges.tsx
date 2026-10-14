import { StatusChip } from "@/components/ui/status-chip";
// §Clinical record — safety badge row (problems / masked SUD / allergies / alerts).
// Shared by the quick-peek drawer header and the full-page chart header.
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, HeartPulse, Lock, ShieldAlert, CalendarX } from "lucide-react";
import type { Patient } from "@/lib/ehr";
import { safetyCounts } from "@/components/clinical/recordSections";

export function RecordSafetyBadges({ patient }: { patient: Patient }) {
  const s = safetyCounts(patient);
  // §Front-door Phase 2 — the missed-handoff flag must be visible to staff
  // wherever the safety badges render (quick-peek drawer + full chart).
  const missed = patient.missedPreReleaseCoordination;
  if (
    !missed &&
    s.activeProblemsCount === 0 &&
    s.hiddenSud === 0 &&
    s.allergyEntries.length === 0 &&
    s.activeAlerts.length === 0
  )
    return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap items-center gap-1.5">
        {missed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <StatusChip lang="en" state="yourturn" label="Missed pre-release coordination" data-testid="missed-prerelease-badge" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              No pre-release plan was found at intake, so the pre-release task list was generated on
              day one instead. Owner: {missed.ownerName}. Medi-Cal must be actively verified — do
              not assume automatic reactivation.
            </TooltipContent>
          </Tooltip>
        )}
        {s.activeProblemsCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-teal/15 text-teal border-0 text-[10px] gap-1">
                <HeartPulse className="h-3 w-3" />
                {s.activeProblemsCount} active problem{s.activeProblemsCount === 1 ? "" : "s"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {s.activeProblems
                .slice(0, 6)
                .map((p) => `${p.code ?? ""} ${p.label}`.trim())
                .join(" · ")}
            </TooltipContent>
          </Tooltip>
        )}
        {s.hiddenSud > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <StatusChip lang="en" state="restricted" label={`${s.hiddenSud} 42 CFR 2 masked`} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              SUD problems present but hidden without Part 2 consent for your role.
            </TooltipContent>
          </Tooltip>
        )}
        {s.allergyEntries.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className={
                  s.severeAllergy
                    ? "bg-urgent-soft text-urgent border-urgent text-sm gap-1"
                    : "bg-muted text-ink-muted border-0 text-sm gap-1"
                }
              >
                <AlertTriangle className="h-3 w-3" />
                {/* Default per published guidance; pending clinical review (Dr. Bagga) */}
                {s.allergyEntries.length} allerg{s.allergyEntries.length === 1 ? "y" : "ies"}{s.severeAllergy ? " · Severe allergy" : ""}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {s.allergyEntries.slice(0, 6).map((a) => `${a.substance} (${a.severity})`).join(" · ")}
            </TooltipContent>
          </Tooltip>
        )}
        {s.activeAlerts.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className={
                  s.criticalAlert
                    ? "bg-surface-sunk text-attention border-0 text-[10px] gap-1"
                    : "bg-muted text-navy border-0 text-[10px] gap-1"
                }
              >
                <ShieldAlert className="h-3 w-3" />
                {s.activeAlerts.length} alert{s.activeAlerts.length === 1 ? "" : "s"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {s.activeAlerts.slice(0, 6).map((a) => `${a.label} (${a.severity})`).join(" · ")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
