// §Group D items 1 + 2 — the plan owner's advocate review queue.
//
// TWO streams, one surface, because both are "an advocate did something that
// the ECM Provider / CF Care Manager must formally look at":
//   1. care-plan contributions  -> accept / decline
//   2. eligibility-assist attestations -> mark reviewed
//
// Ownership is DERIVED per row from the patient's pre-release episode (the
// same `verifyQueueOwnerRole` rule the document verify queue uses), never
// assigned by hand. Acceptance is a STATUS: no advocate text is ever written
// into the authoritative ReentryCarePlan by this component or by the store.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADVOCATE_REVIEW_ROLES } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ClientDate } from "@/components/ClientDate";
import { HeartHandshake, IdCard, Lock } from "lucide-react";

const OWNER_LABEL: Record<string, string> = {
  cf_care_manager: "CF Care Manager",
  ecm_provider: "ECM Provider",
};

export function AdvocateReviewQueue() {
  const { role, staffName } = useActingStaff();
  const [showResolved, setShowResolved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const canReview = ADVOCATE_REVIEW_ROLES.includes(role as never);
  const contributions = useEhr(() =>
    AdelanteEHR.advocateContributionQueue(showResolved ? {} : { status: "pending" }),
  );
  const attestations = useEhr(() =>
    AdelanteEHR.advocateEligibilityAttestationQueue(showResolved ? {} : { status: "pending" }),
  );

  if (!canReview) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" /> Only the ECM Provider or CF Care Manager who owns the plan can
        review advocate input.
      </Card>
    );
  }

  const reviewerName = staffName || "Care team";

  function reviewContribution(id: string, status: "accepted" | "declined") {
    const res = AdelanteEHR.reviewAdvocateContribution({
      contributionId: id,
      status,
      reviewerName,
      reviewerRole: role,
      ...(notes[id] ? { note: notes[id] } : {}),
    });
    if (!res.ok) return toast.error(res.reason);
    setNotes((n) => ({ ...n, [id]: "" }));
    toast.success(res.reason);
  }

  function reviewAttestation(id: string) {
    const res = AdelanteEHR.reviewAdvocateEligibilityAttestation({
      attestationId: id,
      reviewerName,
      reviewerRole: role,
      ...(notes[id] ? { note: notes[id] } : {}),
    });
    if (!res.ok) return toast.error(res.reason);
    setNotes((n) => ({ ...n, [id]: "" }));
    toast.success(res.reason);
  }

  return (
    <div className="space-y-4" data-testid="advocate-review-queue">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <Label htmlFor="adv-show-resolved">Show reviewed</Label>
        <Switch id="adv-show-resolved" checked={showResolved} onCheckedChange={setShowResolved} />
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          <HeartHandshake className="h-5 w-5 text-teal" /> Care-plan input from advocates
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Accepting records that you took this into the plan. It does not change any plan field —
          you still write the plan yourself.
        </p>
        {contributions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting for review.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {contributions.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border p-3 text-sm"
                data-testid={`advocate-contribution-${c.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {c.patientName} · <span className="uppercase tracking-wide">{c.section}</span> ·{" "}
                    {c.authorName}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{OWNER_LABEL[c.ownerRole] ?? c.ownerRole}</Badge>
                    <ClientDate value={c.createdAt} />
                  </span>
                </div>
                <p className="mt-2">{c.text}</p>
                {c.review.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      aria-label="Review note"
                      placeholder="Optional note"
                      className="max-w-xs"
                      value={notes[c.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      data-testid={`accept-${c.id}`}
                      onClick={() => reviewContribution(c.id, "accepted")}
                    >
                      Accept into plan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`decline-${c.id}`}
                      onClick={() => reviewContribution(c.id, "declined")}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.review.status === "accepted" ? "Accepted" : "Declined"} by{" "}
                    {c.review.reviewedBy} ({OWNER_LABEL[c.review.reviewedByRole ?? ""] ?? ""}) ·{" "}
                    <ClientDate value={c.review.reviewedAt ?? c.createdAt} />
                    {c.review.note ? ` · ${c.review.note}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          <IdCard className="h-5 w-5 text-teal" /> Eligibility-assist attestations
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Placeholder:</strong> nothing was submitted to DHCS — an advocate attested that
          they are helping with the member&apos;s application. Review confirms you have seen it.
        </p>
        {attestations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting for review.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {attestations.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border p-3 text-sm"
                data-testid={`advocate-attestation-${a.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {a.patientName} · attested by {a.attestedName} ({a.advocateName})
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{OWNER_LABEL[a.ownerRole] ?? a.ownerRole}</Badge>
                    <ClientDate value={a.createdAt} />
                  </span>
                </div>
                {a.note && <p className="mt-2">{a.note}</p>}
                {a.review.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Pending review</Badge>
                    <Input
                      aria-label="Review note"
                      placeholder="Optional note"
                      className="max-w-xs"
                      value={notes[a.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      data-testid={`review-${a.id}`}
                      onClick={() => reviewAttestation(a.id)}
                    >
                      Mark reviewed
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reviewed by {a.review.reviewedBy} ·{" "}
                    <ClientDate value={a.review.reviewedAt ?? a.createdAt} />
                    {a.review.note ? ` · ${a.review.note}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
