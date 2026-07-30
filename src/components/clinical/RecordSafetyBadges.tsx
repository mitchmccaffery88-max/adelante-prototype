// §Clinical record — safety badge row (problems / masked SUD / allergies / alerts).
// Shared by the quick-peek drawer header and the full-page chart header.
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, HeartPulse, Lock, ShieldAlert } from "lucide-react";
import type { Patient } from "@/lib/ehr";
import { safetyCounts } from "@/components/clinical/recordSections";

export function RecordSafetyBadges({ patient }: { patient: Patient }) {
  const s = safetyCounts(patient);
  if (
    s.activeProblemsCount === 0 &&
    s.hiddenSud === 0 &&
    s.allergyEntries.length === 0 &&
    s.activeAlerts.length === 0
  )
    return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap items-center gap-1.5">
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
              <Badge className="bg-destructive/10 text-destructive border-0 text-[10px] gap-1">
                <Lock className="h-3 w-3" />
                {s.hiddenSud} 42 CFR 2 masked
              </Badge>
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
                    ? "bg-destructive/15 text-destructive border-0 text-[10px] gap-1"
                    : "bg-gold/25 text-navy border-0 text-[10px] gap-1"
                }
              >
                <AlertTriangle className="h-3 w-3" />
                {s.allergyEntries.length} allerg{s.allergyEntries.length === 1 ? "y" : "ies"}
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
                    ? "bg-destructive/15 text-destructive border-0 text-[10px] gap-1"
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
