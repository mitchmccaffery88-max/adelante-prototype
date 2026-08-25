// §P2 — compact, safety-critical summary of the real Stanley-Brown safety plan.
//
// Counts only: `safetyPlanSummary` never returns patient text, so this tile is
// safe to render high on My Care without exposing plan content on a shared or
// shoulder-surfed screen. The full editable plan lives at /safety-plan.
//
// Shown to EVERY patient, deliberately ungated: a safety plan is not
// justice-involvement-specific, and gating it to the JI populations left
// general-population patients with no in-app entry point outside /crisis.
import { Link } from "@tanstack/react-router";
import { LifeBuoy, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";
import { safetyPlanSummary, subscribeSafetyPlan } from "@/lib/safetyPlan";
import { useSyncExternalStore } from "react";

export function SafetyPlanSummaryTile({ patientId }: { patientId: string }) {
  const key = useSyncExternalStore(
    subscribeSafetyPlan,
    () => {
      const s = safetyPlanSummary(patientId);
      return `${s.exists}|${s.entryCount}|${s.sectionsFilled}|${s.updatedAt ?? ""}`;
    },
    () => "",
  );
  void key;
  const summary = safetyPlanSummary(patientId);

  return (
    <Card className="border-primary/40 bg-secondary/40 p-5" data-testid="safety-plan-summary-tile">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <LifeBuoy className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg text-foreground">My safety plan</h2>
            {summary.exists ? (
              <Badge variant="outline" className="text-[10px]">
                {summary.sectionsFilled} of {summary.totalSections} sections filled
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Not started
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.exists ? (
              <>
                Last updated{" "}
                {summary.updatedAt ? (
                  <ClientDate
                    value={summary.updatedAt}
                    options={{ month: "short", day: "numeric" }}
                  />
                ) : (
                  "recently"
                )}
                . Your warning signs, your people, your reasons — ready when you need them.
              </>
            ) : (
              <>
                Written by you, for the hardest hours. It takes a few minutes and it&apos;s
                yours.
              </>
            )}
          </p>
          <Button asChild className="mt-3 min-h-11 rounded-2xl" data-testid="safety-plan-open">
            <Link to="/safety-plan">
              {summary.exists ? "Open my safety plan" : "Start my safety plan"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
