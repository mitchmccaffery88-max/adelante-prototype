import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { identityEvidence, lifecycleForReferral } from "@/lib/careLifecycle";
import { IDENTITY_NEEDED, INTAKE_CLOSE_REASONS } from "@/lib/referralLifecycleActions";
import { referralDeclineReasonLabel } from "@/lib/referralActions";
import type { StaffRole } from "@/lib/roles";
import { LifecycleChip } from "./LifecycleChip";
import { SignupInviteControls } from "./SignupInviteControls";

type Actor = { role: StaffRole; staffId?: string; staffName?: string };

/** Intake's lifecycle moves inside its own workspace: confirm identity, enroll (with evidence), close duplicates/unreachable. */
export function IntakeLifecycleActions({ actor, referralId, reason }: { actor: Actor; referralId: string; reason: string }) {
  const r = useEhr(() => AdelanteEHR.listReferrals().find((x) => x.id === referralId));
  const viewJson = useEhr(() => { const x = AdelanteEHR.listReferrals().find((y) => y.id === referralId); return x ? JSON.stringify(lifecycleForReferral(x)) : ""; });
  const [how, setHow] = useState("");
  if (!r || !viewJson) return null;
  const view = JSON.parse(viewJson);
  const open = r.status === "submitted" || r.status === "contacted";
  const evidence = identityEvidence(r);
  const reasonOk = reason.trim().length >= 3;
  const run = (id: string, args: unknown[], ok: string) => {
    const result = runAction<{ duplicate?: unknown[] }>(id, actor, undefined, { args: [actor, ...args], auditReason: reason });
    if (!result.ok) toast.error(result.reason);
    else if (result.value?.duplicate) toast.message("This person may already exist — send it to Identity review.");
    else toast.success(ok);
  };
  return (
    <div className="flex w-full flex-wrap items-center gap-2" data-testid="intake-lifecycle">
      <LifecycleChip view={view} role={actor.role} showOwner />
      {open && !evidence && (
        <>
          <Input aria-label="How identity was confirmed" placeholder="How identity was confirmed (e.g. In person — photo ID)" value={how} onChange={(e) => setHow(e.target.value)} className="max-w-xs" />
          <Button variant="outline" disabled={!reasonOk || how.trim().length < 3} onClick={() => run("referral_identity_confirm", [referralId, how, reason], "Identity confirmed")}>Record identity confirmed</Button>
        </>
      )}
      {open && (
        <Button disabled={!reasonOk || !evidence} title={evidence ? undefined : IDENTITY_NEEDED} onClick={() => run("referral_enroll", [referralId, reason], "Enrolled")}>Enroll</Button>
      )}
      {open && !evidence && <span className="text-sm text-ink-muted">{IDENTITY_NEEDED}</span>}
      {open && INTAKE_CLOSE_REASONS.map((k) => (
        <Button key={k} variant="ghost" disabled={!reasonOk} onClick={() => run("referral_close", [referralId, { reason: k }, reason], "Referral closed")}>Close — {referralDeclineReasonLabel(k).toLowerCase()}</Button>
      ))}
      {open && <SignupInviteControls actor={actor} referralId={referralId} reason={reason} />}
    </div>
  );
}
