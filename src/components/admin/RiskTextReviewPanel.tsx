// §Admin — clinical review + promotion of draft risk-text translations.
//
// Draft Spanish disclosures (es-v1-draft) only become the reviewed wording
// (es-v1) after BOTH required sign-offs are recorded here. Promotion changes
// governance metadata only — the catalog strings are untouched — and locks the
// English snapshot on newly created forms as an archival reference. Already
// signed/created forms are never retro-edited.
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type RiskTextReview } from "@/lib/ehr";
import { RISK_TEXT_CATALOG_ES, type MedClass } from "@/lib/refusal";
import { useActingRole, useActingStaff, canAccess } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { BadgeCheck, Languages, Lock, ShieldAlert } from "lucide-react";

/** Suggested signer per required slot; editable — the recorded name is what signs. */
const SUGGESTED_REVIEWER: Record<string, string> = {
  clinical_director: "Christi",
  medical_director: "Dr. Bagga",
};

export function RiskTextReviewPanel() {
  const [role] = useActingRole();
  const { staff } = useActingStaff();
  const reviews = useEhr(() => AdelanteEHR.listRiskTextReviews());
  const slots = useMemo(() => AdelanteEHR.riskTextReviewerRoles(), []);

  const canReview =
    role === "sys_admin" ||
    role === "clinical_coordinator" ||
    canAccess(role, "meds_erx").level === "write";

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-navy flex items-center gap-2">
            <Languages className="h-4 w-4 text-teal" /> Risk-text translation review
          </h2>
          <p className="text-xs text-muted-foreground">
            Draft translations are presented to patients as drafts until Christi and Dr. Bagga both
            sign off. Approval promotes the version and locks the English snapshot as a reference
            copy on new refusal forms.
          </p>
        </div>
        {!canReview && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            Read only
          </Badge>
        )}
      </div>

      {reviews.map((review) => (
        <ReviewRow
          key={review.language}
          review={review}
          slots={slots}
          canReview={canReview}
          actorName={staff?.name ?? "Unknown staff"}
        />
      ))}
    </Card>
  );
}

function ReviewRow({
  review,
  slots,
  canReview,
  actorName,
}: {
  review: RiskTextReview;
  slots: { role: string; label: string }[];
  canReview: boolean;
  actorName: string;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revokeReason, setRevokeReason] = useState("");
  const approved = review.status === "approved";

  const sign = (slotRole: string) => {
    try {
      AdelanteEHR.signRiskTextReview({
        language: review.language,
        role: slotRole as never,
        reviewerName: names[slotRole] ?? SUGGESTED_REVIEWER[slotRole] ?? "",
        note: notes[slotRole],
      });
      toast.success(`Sign-off recorded for ${review.languageLabel}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record sign-off.");
    }
  };

  const revoke = () => {
    try {
      AdelanteEHR.revokeRiskTextReview(review.language, revokeReason, actorName);
      setRevokeReason("");
      toast.success("Approval revoked — the translation is a draft again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke approval.");
    }
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm text-navy">{review.languageLabel} risk text</span>
        {approved ? (
          <Badge className="text-[10px] gap-1">
            <BadgeCheck className="h-3 w-3" /> Approved · {review.effectiveVersion}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500 text-amber-700">
            <ShieldAlert className="h-3 w-3" /> Draft · {review.draftVersion}
          </Badge>
        )}
        {approved && review.approvedAt && (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Lock className="h-3 w-3" /> English snapshot locked ·{" "}
            <ClientDate value={review.approvedAt} />
          </span>
        )}
      </div>

      {review.revokedReason && !approved && (
        <p className="text-[11px] text-muted-foreground">
          Last revoked by {review.revokedBy} — {review.revokedReason}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          const signed = review.signoffs.find((s) => s.role === slot.role);
          return (
            <div key={slot.role} className="rounded-md bg-muted/40 p-2.5 space-y-2">
              <Label className="text-xs">{slot.label}</Label>
              {signed ? (
                <div className="text-xs">
                  <p className="font-medium text-navy">{signed.reviewerName}</p>
                  <p className="text-muted-foreground">
                    Signed <ClientDate value={signed.signedAt} />
                  </p>
                  {signed.note && <p className="mt-1 text-muted-foreground">“{signed.note}”</p>}
                </div>
              ) : (
                <>
                  <Input
                    aria-label={`${slot.label} reviewer name`}
                    placeholder={SUGGESTED_REVIEWER[slot.role] ?? "Reviewer name"}
                    value={names[slot.role] ?? SUGGESTED_REVIEWER[slot.role] ?? ""}
                    disabled={!canReview}
                    onChange={(e) => setNames((n) => ({ ...n, [slot.role]: e.target.value }))}
                  />
                  <Textarea
                    aria-label={`${slot.label} review note`}
                    rows={2}
                    placeholder="Review note (optional)"
                    value={notes[slot.role] ?? ""}
                    disabled={!canReview}
                    onChange={(e) => setNotes((n) => ({ ...n, [slot.role]: e.target.value }))}
                  />
                  <Button size="sm" disabled={!canReview} onClick={() => sign(slot.role)}>
                    Record sign-off
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {approved && canReview && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="Revoke approval reason"
            placeholder="Reason for revoking approval"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={revoke} disabled={!revokeReason.trim()}>
            Revoke approval
          </Button>
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Preview wording under review</summary>
        <div className="mt-2 space-y-2">
          {(Object.keys(RISK_TEXT_CATALOG_ES) as MedClass[]).map((cls) => (
            <div key={cls}>
              <p className="font-medium text-navy">{RISK_TEXT_CATALOG_ES[cls].label}</p>
              <p className="whitespace-pre-line">{RISK_TEXT_CATALOG_ES[cls].text}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
