// §Crisis-flag stopgap — one-tap manual signal source into the EXISTING crisis
// escalation system. It calls AdelanteEHR.flagCrisis (the same call the
// screener-band gate uses), only with triggerSource "assisted_signup" so the
// manual path stays distinguishable from the automated one. No new escalation,
// severity, or routing logic lives here.
import { useState } from "react";
import { toast } from "sonner";
import { Siren } from "lucide-react";
import { AdelanteEHR } from "@/lib/ehr";
import { canFlagCrisis, useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";

export const ASSISTED_SIGNUP_CRISIS_DETAIL =
  "Manual flag during sign-up assistance — helper raised immediate concern.";

export function AssistedSignupCrisisButton({
  patientId,
  className,
}: {
  patientId: string | undefined;
  className?: string;
}) {
  const { role, staffName } = useActingStaff();
  const [busy, setBusy] = useState(false);
  if (!patientId || !canFlagCrisis(role)) return null;

  const flag = () => {
    setBusy(true);
    try {
      AdelanteEHR.flagCrisis(patientId, staffName, ASSISTED_SIGNUP_CRISIS_DETAIL, {
        triggerSource: "assisted_signup",
      });
      toast.success("Crisis flagged", {
        description: "Added to the crisis queue as a manual sign-up flag. Stay with the person.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not flag crisis.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={busy}
      onClick={flag}
      aria-label="Flag crisis now"
      className={className}
    >
      <Siren className="h-4 w-4 mr-1.5" aria-hidden="true" /> Flag crisis now
    </Button>
  );
}