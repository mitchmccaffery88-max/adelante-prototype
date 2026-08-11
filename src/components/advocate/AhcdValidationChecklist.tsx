// §v3.0 Phase 4.2 (6.5) — the frontline validation checklist a CF Care Manager
// works through with the Advance Health Care Directive in hand.
//
// Five independently tracked findings, each mirrored by a real CaseTask on the
// worklist. Item 4 is deliberately NOT a checkbox: the incapacity
// determination IS the activation, so it is recorded by a clinician here and
// calls the real activation function.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  AHCD_DETERMINATION_ROLES,
  type AhcdChecklistItemKey,
  type AhcdChecklistOutcome,
  type AhcdDeterminationRole,
} from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientDate } from "@/components/ClientDate";
import { CheckCircle2, XCircle, HelpCircle, Circle, Stethoscope } from "lucide-react";

const OUTCOME_UI: Record<AhcdChecklistOutcome, { label: string; icon: typeof Circle; cls: string }> = {
  pending: { label: "Not checked", icon: Circle, cls: "text-muted-foreground" },
  verified: { label: "Verified", icon: CheckCircle2, cls: "text-teal" },
  failed: { label: "Failed", icon: XCircle, cls: "text-destructive" },
  unclear: { label: "Unclear", icon: HelpCircle, cls: "text-amber-600" },
};

export function AhcdValidationChecklist({
  linkId,
  reviewerName,
  reviewerRole,
  className,
}: {
  linkId: string;
  reviewerName: string;
  /** The signed-in staff member's real role — gates who may record item 4. */
  reviewerRole: string;
  className?: string;
}) {
  const state = useEhr(() => AdelanteEHR.ahcdValidationState(linkId));
  const [basis, setBasis] = useState("");
  const [reviewByDate, setReviewByDate] = useState("");
  const mayDetermine = (AHCD_DETERMINATION_ROLES as readonly string[]).includes(reviewerRole);

  function record(item: AhcdChecklistItemKey, outcome: AhcdChecklistOutcome) {
    try {
      AdelanteEHR.recordAhcdChecklistItem(linkId, { item, outcome, reviewedBy: reviewerName });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record that finding.");
    }
  }

  function activate() {
    try {
      AdelanteEHR.activateAdvocateAhcd(linkId, {
        determinedBy: reviewerName,
        determinedByRole: reviewerRole,
        basis,
        ...(reviewByDate ? { reviewByDate } : {}),
      });
      setBasis("");
      setReviewByDate("");
      toast.success("Directive is now clinically active.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not activate the directive.");
    }
  }

  return (
    <Card className={`p-5 space-y-4 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-navy">AHCD validation checklist</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Work through this with the original directive in hand. The agent gets no expanded
            access until a clinician records an incapacity determination at the end.
          </p>
        </div>
        <Badge variant={state.active ? "default" : "secondary"}>
          {state.active ? "Clinically active" : "Dormant"}
        </Badge>
      </div>

      <ol className="space-y-3">
        {state.items.map((item) => {
          const outcome = item.finding?.outcome ?? "pending";
          const ui = OUTCOME_UI[outcome];
          const Icon = ui.icon;
          const isDetermination = item.key === "incapacity_determination";
          return (
            <li key={item.key} className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ui.cls}`} />
                <div className="min-w-0">
                  <p className="font-medium text-navy">
                    {item.order}. {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                  {item.finding && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ui.label} by {item.finding.reviewedBy} ·{" "}
                      <ClientDate value={item.finding.reviewedAt} />
                    </p>
                  )}
                </div>
              </div>

              {!isDetermination && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => record(item.key, "verified")}>
                    Verified
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => record(item.key, "failed")}>
                    Failed
                  </Button>
                  {item.key === "part2_scope" && (
                    <Button size="sm" variant="ghost" onClick={() => record(item.key, "unclear")}>
                      Unclear — needs ASCMI
                    </Button>
                  )}
                </div>
              )}

              {isDetermination && !state.active && (
                <div className="space-y-2 rounded-md bg-muted/40 p-3">
                  {!mayDetermine ? (
                    <p className="text-xs text-muted-foreground flex items-start gap-2">
                      <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Only a PMHNP or licensed therapist can record this determination. Finish
                      items 1–3 and 5, then route the chart to the treating clinician.
                    </p>
                  ) : !state.readiness.ready ? (
                    <p className="text-xs text-muted-foreground">{state.readiness.reason}</p>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="ahcd-basis">Basis for the determination</Label>
                        <Input
                          id="ahcd-basis"
                          value={basis}
                          onChange={(e) => setBasis(e.target.value)}
                          placeholder="What you observed, and where it is documented"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ahcd-review">
                          Review date (optional — for a temporary determination)
                        </Label>
                        <Input
                          id="ahcd-review"
                          type="date"
                          value={reviewByDate}
                          onChange={(e) => setReviewByDate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          If set, the directive returns to dormant on this date by itself.
                        </p>
                      </div>
                      <Button size="sm" onClick={activate} disabled={!basis.trim()}>
                        Record determination &amp; activate
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {state.part2ScopeUnclear && (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          The directive's language does not plainly cover substance use or psychotherapy records.
          Even while the directive is active, those stay masked until the agent separately
          executes the ASCMI form (42 CFR Part 2 disclosure authorization).
        </p>
      )}

      {state.activation?.reviewByDate && state.active && (
        <p className="text-xs text-muted-foreground">
          Temporary determination — under review by{" "}
          <ClientDate value={state.activation.reviewByDate} />.
        </p>
      )}
    </Card>
  );
}
