// §Quality pass Group A — live supervision status for supervised roles.
//
// Reads `useSupervisionStatus()`, which is a thin live wrapper over the Phase 1
// `supervisionStatus()`. NOTHING is recomputed here: billability comes from the
// same `satisfied` flag `isBillableStaff()` returns, so the banner can never
// disagree with the gate that actually blocks a claim.
import { requiresSupervision, useActingStaff, useSupervisionStatus } from "@/lib/roles";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export function SupervisionBanner({ className = "" }: { className?: string }) {
  const { role, staffId } = useActingStaff();
  const status = useSupervisionStatus(staffId);
  if (!requiresSupervision(role)) return null;

  const ok = status.satisfied;
  return (
    <div
      role="status"
      data-testid="supervision-banner"
      className={
        "mb-6 flex items-start gap-2 rounded-md border p-3 text-sm " +
        (ok
          ? "border-teal/40 bg-teal/10 text-navy"
          : "border-destructive/40 bg-destructive/10 text-destructive ") +
        className
      }
    >
      {ok ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="font-semibold">
          {ok
            ? `Supervised by ${status.supervisor?.name}`
            : "Supervision incomplete — work is not billable"}
        </div>
        <div className="text-xs opacity-90">
          {ok ? (
            <>
              Supervision requirement satisfied. Notes and services you document are billable
              through {status.supervisor?.name}
              {status.supervisor?.credential ? `, ${status.supervisor.credential}` : ""}.
            </>
          ) : (
            <>
              {status.reason} Notes you write can still be recorded, but claims generated from
              them will not be billable until an LPHA-tier supervisor (Therapist or PMHNP) is
              assigned in Supervision admin.
            </>
          )}
        </div>
      </div>
    </div>
  );
}