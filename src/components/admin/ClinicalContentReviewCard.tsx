// §Admin — real, visible status of clinical content still awaiting sign-off.
// Reads the same flags the patient/clinician UI reads, so this panel can never
// claim "reviewed" while the product still renders draft text.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SAFETY_PLAN_REVIEW, SAFETY_PLAN_SECTIONS } from "@/lib/safetyPlan";
import {
  NALOXONE_ACCESS_POINTS,
  NALOXONE_ACCESS_REVIEW,
  NALOXONE_STEPS,
  SAFETY_CONTENT_REVIEW,
} from "@/lib/safetyContent";
import { TriangleAlert, CheckCircle2 } from "lucide-react";
import { RECOVERY_STAGES, RECOVERY_STAGE_REVIEW } from "@/lib/recoveryStages";

export function ClinicalContentReviewCard() {
  const pendingSections = SAFETY_PLAN_SECTIONS.filter((s) => s.clinicalReviewPending).length;
  const pending =
    SAFETY_PLAN_REVIEW.pending ||
    pendingSections > 0 ||
    SAFETY_CONTENT_REVIEW.pending ||
    RECOVERY_STAGE_REVIEW.pending;
  return (
    <Card className="p-3 space-y-2" data-testid="clinical-content-review">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-navy">Clinical content review status</h2>
        <Badge
          className={
            pending
              ? "bg-amber-500/15 text-amber-700 border-0 text-[10px]"
              : "bg-emerald-500/15 text-emerald-700 border-0 text-[10px]"
          }
        >
          {pending ? "Review pending" : "Signed off"}
        </Badge>
      </div>
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
        {pending ? (
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
        )}
        <div>
          <p className="font-medium text-navy">Safety plan (Stanley-Brown)</p>
          <p>
            {pendingSections} of {SAFETY_PLAN_SECTIONS.length} section prompts are draft text
            awaiting {SAFETY_PLAN_REVIEW.reviewers}. {SAFETY_PLAN_REVIEW.scope}
          </p>
        </div>
      </div>
      {SAFETY_CONTENT_REVIEW.pending && (
        <div
          className="flex items-start gap-2 text-[11px] text-muted-foreground"
          data-testid="naloxone-content-review"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
          <div>
            <p className="font-medium text-navy">Overdose response guidance</p>
            <p>
              {NALOXONE_STEPS.length} administration steps and the tolerance warning awaiting{" "}
              {SAFETY_CONTENT_REVIEW.reviewers}. {SAFETY_CONTENT_REVIEW.scope}
            </p>
          </div>
        </div>
      )}
      <div
        className="flex items-start gap-2 text-[11px] text-muted-foreground"
        data-testid="naloxone-access-review"
      >
        {NALOXONE_ACCESS_REVIEW.pending ? (
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
        )}
        <div>
          <p className="font-medium text-navy">Naloxone access points (contact verification)</p>
          <p>
            {NALOXONE_ACCESS_POINTS.filter((p) => p.verified).length} of{" "}
            {NALOXONE_ACCESS_POINTS.length} access points confirmed by{" "}
            {NALOXONE_ACCESS_REVIEW.verifiedBy} on {NALOXONE_ACCESS_REVIEW.verifiedOn}. This is a
            separate track from clinical sign-off and does not cover the guidance above.
          </p>
        </div>
      </div>
    </Card>
  );
}