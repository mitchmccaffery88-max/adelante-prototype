// §Phase 9a — issue a sign-in (record-claim) code for a record with no login.
// Reuses the enrollment-code mechanism; redemption is `redeemEnrollmentCode`.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, RECORD_CLAIM_CODE_ROLES, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export function IssueSignInCodeButton({ patientId }: { patientId: string }) {
  const { role, staffId, staffName } = useActingStaff();
  const hasLogin = useEhr(() => Boolean(AdelanteEHR.getPatient(patientId)?.signupCredential));
  const [shown, setShown] = useState<{ code: string; expiresAt: string } | null>(null);
  if (hasLogin) return null;
  const allowed = RECORD_CLAIM_CODE_ROLES.includes(role);
  return (
    <div className="flex flex-col items-end gap-1" data-testid="issue-signin-code">
      <Button
        size="sm"
        variant="outline"
        disabled={!allowed}
        title={
          allowed
            ? "This person has no sign-in yet. Give them a code to claim this record."
            : "Only reentry care managers and ECM providers can issue sign-in codes."
        }
        onClick={() => {
          try {
            const c = AdelanteEHR.issueRecordClaimCode({
              patientId,
              actorStaffId: staffId,
              actorName: staffName,
              actorRole: role,
            });
            setShown({ code: c.code, expiresAt: c.expiresAt });
            toast.success("Sign-in code ready", { description: "Single use, valid 90 days." });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not issue a code.");
          }
        }}
      >
        <KeyRound className="h-3.5 w-3.5" /> Issue sign-in code
      </Button>
      {shown && (
        <div className="rounded-md border border-teal/40 bg-teal/5 px-3 py-2 text-right">
          <div className="font-mono text-base text-navy" data-testid="issued-signin-code">
            {shown.code}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Single use · expires {shown.expiresAt.slice(0, 10)} · they enter it at "Already have a
            care plan?"
          </div>
        </div>
      )}
    </div>
  );
}
