import { StatusChip } from "@/components/ui/status-chip";
// §Advocate Build 2 item 1 — persistent identity banner.
//
// The patient's name is released by `advocatePatientIdentity`, which resolves
// the SAME live gate as every other advocate read. A link row existing is not
// enough: an AHCD that no clinician has activated, a family-participation link
// with no active ROI, an unclaimed/expired/revoked link, or a link whose
// authorization type was never confirmed all render the pending state with NO
// name. Nothing here can compute or override that decision.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export function AdvocateIdentityBanner({ linkId }: { linkId: string }) {
  const identity = useEhr(() => AdelanteEHR.advocatePatientIdentity(linkId));

  if (!identity.allowed) {
    return (
      <Card
        data-testid="advocate-identity-pending"
        className="flex gap-3 border-attention bg-attention-soft p-4 text-sm"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
        <div>
          <p className="font-medium text-navy">Access pending verification</p><StatusChip state="restricted" />
          <p className="mt-1 text-muted-foreground">{identity.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Until this is resolved we can't show you who you're connected to, or anything about
            their care.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-testid="advocate-identity-banner"
      className="flex flex-wrap items-center justify-between gap-3 border-teal/40 bg-teal/5 p-4 text-sm"
    >
      <span className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal" />
        <span className="font-medium text-navy">
          You're viewing {identity.firstName}'s information
        </span>
      </span>
      <StatusChip state="done" title="Access verified" />
    </Card>
  );
}
