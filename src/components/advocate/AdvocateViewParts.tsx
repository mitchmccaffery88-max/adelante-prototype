// §Advocate Access Redesign Phase 2 (final) — shared chrome for the advocate's
// real child views. One page header, one access gate, so every destination
// looks like the same shell and the "no access" refusal is worded identically
// everywhere instead of once per page.
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";

export function AdvocateViewHeader({
  icon: Icon,
  title,
  lede,
}: {
  icon: LucideIcon;
  title: string;
  lede?: string;
}) {
  return (
    <header className="space-y-1">
      <h1 className="flex items-center gap-2 font-display text-xl text-navy">
        <Icon className="h-5 w-5 text-teal" aria-hidden="true" /> {title}
      </h1>
      {lede && <p className="text-sm text-muted-foreground">{lede}</p>}
    </header>
  );
}

/**
 * Wraps any "Supporting [Name]" destination. The gate itself is the existing
 * live store decision — this only renders it; it grants nothing.
 */
export function AdvocateSupportGate({
  linkId,
  children,
}: {
  linkId: string;
  children: React.ReactNode;
}) {
  const view = useEhr(() => AdelanteEHR.advocateSchedule(linkId));
  if (view.allowed) return <>{children}</>;
  return (
    <Card className="flex gap-3 p-5 text-sm">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="font-medium text-navy">You don't have access right now</p>
        <p className="mt-1 text-muted-foreground">{view.reason}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing about this person's care is shown until that is resolved.
        </p>
      </div>
    </Card>
  );
}

/** The person's first name when the identity gate allows it, else null. */
export function useSupportingName(linkId: string): string | null {
  const identity = useEhr(() => AdelanteEHR.advocatePatientIdentity(linkId));
  return identity.allowed ? (identity.firstName ?? null) : null;
}
