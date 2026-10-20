// Privacy P3 — first-outreach question: may we tell the referrer about enrollment?
import { useState } from "react";
import { toast } from "sonner";
import { useEhr, type Referral } from "@/lib/ehr";
import { recordReferrerAuthorization, referrerAuthorizationFor, revokeReferrerAuthorization } from "@/lib/referrerAuthorizationStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { getActingRole } from "@/lib/roles";
import { canPerformReferralAction } from "@/lib/referralActions";
import {
  REFERRER_POLICY_DRAFT, REFERRER_TYPE_LABELS, authorizationActive, authorizationQuestion,
  referrerDisplayName, referrerTypeOf,
} from "@/lib/referrerPolicy";
import { latestHeldReason } from "@/lib/referrerUpdateGate";

export function ReferrerAuthorizationCard({ referral }: { referral: Referral }) {
  const [revoking, setRevoking] = useState(false);
  const mayRecord = canPerformReferralAction(getActingRole(), "contact");
  const type = referrerTypeOf(referral.referrerType);
  const named = referrerDisplayName(referral);
  const a = useEhr(() => referrerAuthorizationFor(referral.id));
  const active = authorizationActive(a, named);
  const held = useEhr(() => latestHeldReason(referral));
  const record = (answer: "yes" | "no") => {
    try {
      recordReferrerAuthorization(referral.id, answer, named);
      toast.success(answer === "yes" ? "Recorded: OK to share enrollment." : "Recorded: do not share.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That couldn't be recorded.");
    }
  };
  return (
    <Card className="p-4 space-y-2 text-sm" data-testid="referrer-authorization">
      <h3 className="font-semibold text-ink">Updates to the referrer</h3>
      <p className="text-ink-muted">Referrer type: <span className="text-ink" data-testid="referrer-type-label">{REFERRER_TYPE_LABELS[type]}</span></p>
      <p className="text-ink">{authorizationQuestion(referral)}</p>
      {a ? (
        <p className="text-ink-muted" data-testid="referrer-authorization-status">
          {a.revokedAt ? "Revoked" : a.answer === "yes" ? "Yes" : "No"} · recorded by {a.recordedBy.name} · <ClientDate value={a.recordedAt} />
          {a.revokedAt && a.revokedBy ? <> · revoked by {a.revokedBy.name} · <ClientDate value={a.revokedAt} /></> : null}
          {a.referrerNamed !== named ? " · named a different referrer" : ""}
        </p>
      ) : (
        <p className="text-ink-muted" data-testid="referrer-authorization-status">Not asked yet</p>
      )}
      {mayRecord && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => record("yes")} disabled={active}>Yes, OK to tell them</Button>
          <Button size="sm" variant="outline" onClick={() => record("no")} disabled={a?.answer === "no" && !a.revokedAt}>No</Button>
          {active && <Button size="sm" variant="outline" onClick={() => setRevoking(true)}>Revoke</Button>}
        </div>
      )}
      {held && <p className="text-ink" data-testid="referrer-update-held">{held}</p>}
      <p className="text-ink-muted">{REFERRER_POLICY_DRAFT}</p>
      <ConfirmDialog open={revoking} onOpenChange={setRevoking} title="Revoke authorization" description="Future updates to this referrer will be held." confirmLabel="Revoke" keepLabel="Keep" onConfirm={() => {
        try { revokeReferrerAuthorization(referral.id); return true; } catch { return false; }
      }} />
    </Card>
  );
}
