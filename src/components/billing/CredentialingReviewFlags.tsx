import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useEhrExt } from "@/lib/ehr-ext";
import { billingAppointments, billingClaims } from "@/lib/billingProjection";
import { credentialingReviewFlags, CREDENTIALING_REASON_LABEL, useCredentialing } from "@/lib/credentialing";
import { canAccess, getStaffMember, useActingStaff } from "@/lib/roles";
import { StatusChip } from "@/components/ui/status-chip";

/** 27 Oct credentialing batch: isolated projection, preserving Billing's pinned bindings. */
export function CredentialingReviewFlags() {
  const { role } = useActingStaff();
  if (canAccess(role, "billing").level === "none") return null;
  return <CredentialingReviewFlagsBody />;
}

function CredentialingReviewFlagsBody() {
  const appointments = useEhr(() => billingAppointments());
  const claims = useEhrExt(() => billingClaims());
  const flags = useCredentialing(
    () => credentialingReviewFlags(appointments, claims.map(c => ({ ...c, serviceType: appointments.find(a => a.id === c.encounterId)?.serviceType })), (pid) => AdelanteEHR.activeCoveragePlan(pid)?.payer),
  );
  if (flags.length === 0) return null;
  return (
    <section className="border border-line-strong bg-surface-sunk p-4 rounded-md" data-testid="billing-cred-review-flags">
      <h3 className="font-semibold">Flagged for Billing review ({flags.length})</h3>
      <p className="text-sm text-muted-foreground">Existing appointments and claims remain unchanged. Draft — pending go-live permissions audit and compliance review.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {flags.map((flag) => (
          <li key={`${flag.kind}-${flag.id}`} className="flex flex-wrap items-center gap-2">
            <StatusChip lang="en" state="yourturn" label={flag.kind === "claim" ? "Claim" : "Appointment"} />
            <span className="font-medium">{getStaffMember(flag.staffId)?.name ?? flag.staffId}</span>
            <span className="text-muted-foreground">{[...new Set(flag.reasons.map((reason) => CREDENTIALING_REASON_LABEL[reason]))].join("; ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}