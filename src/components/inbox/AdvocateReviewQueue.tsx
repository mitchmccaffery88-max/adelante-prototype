import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
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
        <StaffTable rows={contributions} rowKey={(c)=>c.id} label="Care-plan input from advocates" testId="advocate-contributions-table" rowTestId={(c)=>`advocate-contribution-${c.id}`}
          views={[{id:"current",label:"Current view",matches:()=>true},{id:"needs",label:"Needs you",matches:(c)=>c.review.status === "pending"}]} defaultView="current" emptyState="Nothing waiting for review."
          columns={[
            {id:"patient",label:"Patient",sortValue:(c)=>c.patientName,cell:(c)=>c.patientName},
            {id:"input",label:"Input",cell:(c)=><>{c.section} · {c.authorName}<p>{c.text}</p></>},
            {id:"owner",label:"Owner",sortValue:(c)=>c.ownerRole,cell:(c)=><Badge variant="outline">{OWNER_LABEL[c.ownerRole] ?? c.ownerRole}</Badge>},
            {id:"date",label:"Received",sortValue:(c)=>c.createdAt,cell:(c)=><ClientDate value={c.createdAt} />},
            {id:"status",label:"Review",sortValue:(c)=>c.review.status,cell:(c)=>c.review.status === "pending" ? <StatusChip lang="en" state={c.ownerRole === role ? "yourturn" : "team"} label="Pending review" /> : <>{c.review.status === "accepted" ? "Accepted" : "Declined"} by {c.review.reviewedBy} ({OWNER_LABEL[c.review.reviewedByRole ?? ""] ?? ""}) · <ClientDate value={c.review.reviewedAt ?? c.createdAt} />{c.review.note ? ` · ${c.review.note}` : ""}</>},
            {id:"note",label:"Review note",cell:(c)=>c.review.status === "pending" ? <Input aria-label="Review note" placeholder="Optional note" value={notes[c.id] ?? ""} onChange={(e)=>setNotes((n)=>({...n,[c.id]:e.target.value}))} /> : "—"},
          ]}
          primaryAction={(c)=>c.review.status === "pending" ? <Button size="sm" variant="outline" data-testid={`accept-${c.id}`} onClick={()=>reviewContribution(c.id,"accepted")}>Accept into plan</Button> : null}
          moreContent={(c)=>c.review.status === "pending" ? <Button size="sm" variant="outline" data-testid={`decline-${c.id}`} onClick={()=>reviewContribution(c.id,"declined")}>Decline</Button> : null}
        />
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          <IdCard className="h-5 w-5 text-teal" /> Eligibility-assist attestations
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Placeholder:</strong> nothing was submitted to DHCS — an advocate attested that
          they are helping with the member&apos;s application. Review confirms you have seen it.
        </p>
        <StaffTable rows={attestations} rowKey={(a)=>a.id} label="Eligibility-assist attestations" testId="advocate-attestations-table" rowTestId={(a)=>`advocate-attestation-${a.id}`}
          views={[{id:"current",label:"Current view",matches:()=>true},{id:"needs",label:"Needs you",matches:(a)=>a.review.status === "pending"}]} defaultView="current" emptyState="Nothing waiting for review."
          columns={[
            {id:"patient",label:"Patient",sortValue:(a)=>a.patientName,cell:(a)=>a.patientName},
            {id:"attested",label:"Attested by",sortValue:(a)=>a.attestedName,cell:(a)=><>{a.attestedName} ({a.advocateName}){a.note && <p>{a.note}</p>}</>},
            {id:"owner",label:"Owner",sortValue:(a)=>a.ownerRole,cell:(a)=><Badge variant="outline">{OWNER_LABEL[a.ownerRole] ?? a.ownerRole}</Badge>},
            {id:"date",label:"Received",sortValue:(a)=>a.createdAt,cell:(a)=><ClientDate value={a.createdAt} />},
            {id:"status",label:"Review",sortValue:(a)=>a.review.status,cell:(a)=>a.review.status === "pending" ? <StatusChip lang="en" state={a.ownerRole === role ? "yourturn" : "team"} label="Pending review" /> : <>Reviewed by {a.review.reviewedBy} · <ClientDate value={a.review.reviewedAt ?? a.createdAt} />{a.review.note ? ` · ${a.review.note}` : ""}</>},
            {id:"note",label:"Review note",cell:(a)=>a.review.status === "pending" ? <Input aria-label="Review note" placeholder="Optional note" value={notes[a.id] ?? ""} onChange={(e)=>setNotes((n)=>({...n,[a.id]:e.target.value}))} /> : "—"},
          ]}
          primaryAction={(a)=>a.review.status === "pending" ? <Button size="sm" variant="outline" data-testid={`review-${a.id}`} onClick={()=>reviewAttestation(a.id)}>Mark reviewed</Button> : null}
        />
      </Card>
    </div>
  );
}
