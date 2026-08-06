// §Group sessions — care-plan group eligibility gate (staff-facing).
//
// PLACEHOLDER CRITERIA: the reason is free text and the curriculum-need tag is
// an invented label. Christi/SMEs must supply the real eligibility criteria and
// the real curriculum taxonomy before this is anything but structure.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, GROUP_ELIGIBILITY_ROLES, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";

export function GroupEligibilityEditor({
  patientId,
  actor,
}: {
  patientId: string;
  actor: string;
}) {
  const { role } = useActingStaff();
  const eligibility = useEhr(() => AdelanteEHR.getGroupEligibility(patientId));
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState("");
  const canSet = (GROUP_ELIGIBILITY_ROLES as readonly string[]).includes(role);

  return (
    <Card className="p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-navy">Group eligibility (care plan)</h4>
        {eligibility ? (
          <Badge variant="secondary">Eligible</Badge>
        ) : (
          <Badge variant="outline">Not set</Badge>
        )}
      </div>

      {eligibility ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="text-foreground">{eligibility.reason}</p>
          {eligibility.curriculumNeedTag && (
            <p>Curriculum need (placeholder tag): {eligibility.curriculumNeedTag}</p>
          )}
          <p>
            Set by {eligibility.setBy} ({eligibility.setByRole}) on{" "}
            <ClientDate value={eligibility.setAt} />
          </p>
          {canSet && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const why = window.prompt("Reason for removing group eligibility?") ?? "";
                try {
                  AdelanteEHR.clearGroupEligibility(patientId, why, actor);
                  toast.success("Group eligibility removed");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not update.");
                }
              }}
            >
              Remove eligibility
            </Button>
          )}
        </div>
      ) : !canSet ? (
        <p className="text-xs text-muted-foreground">
          Only a therapist, PMHNP or case manager can set this.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[11px]">Clinical reason (placeholder — free text)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">
              Curriculum need tag (PLACEHOLDER — not a DHCS taxonomy)
            </Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={() => {
              try {
                AdelanteEHR.setGroupEligibility({
                  patientId,
                  reason,
                  curriculumNeedTag: tag,
                  role,
                  actor,
                });
                toast.success("Group eligibility set");
                setReason("");
                setTag("");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not set eligibility.");
              }
            }}
          >
            Set eligible
          </Button>
        </div>
      )}
    </Card>
  );
}