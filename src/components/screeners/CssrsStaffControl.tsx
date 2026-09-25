// §Phase 10b — staff C-SSRS controls: risk badge + "Administer C-SSRS".
// Used on the crisis queue and the chart Tracking tab. Never blocks or delays
// the crisis workflow; the queue's resolve/claim controls stay first-class.
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { CSSRS_KEY, CSSRS_RISK_LABEL, type CssrsRisk } from "@/lib/cssrs";
import { useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CssrsForm } from "@/components/screeners/CssrsForm";

const TONE: Record<CssrsRisk, string> = {
  none: "bg-muted text-muted-foreground",
  low: "bg-amber-500/15 text-foreground",
  moderate: "bg-orange-500/20 text-foreground",
  high: "bg-destructive/15 text-destructive",
};

export function CssrsRiskBadge({ risk }: { risk?: CssrsRisk }) {
  if (!risk) return null;
  return (
    <Badge className={`${TONE[risk]} border-0 text-[10px]`} data-testid="cssrs-risk-badge">
      C-SSRS: {CSSRS_RISK_LABEL[risk]}
    </Badge>
  );
}

export function CssrsStaffControl({ patientId, risk }: { patientId: string; risk?: CssrsRisk }) {
  const [open, setOpen] = useState(false);
  const { staffName, role } = useActingStaff();
  const latest = useEhr(() => AdelanteEHR.getPatient(patientId)?.screeners?.[CSSRS_KEY]?.cssrsRisk);
  const requested = useEhr(() => Boolean(AdelanteEHR.openCssrsRequest(patientId)));
  return (
    <>
      <CssrsRiskBadge risk={risk ?? latest} />
      {requested && (
        <Badge variant="outline" className="text-[10px]" data-testid="cssrs-requested">
          C-SSRS indicated
        </Badge>
      )}
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="cssrs-administer">
        Administer C-SSRS
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>C-SSRS Screener (staff-administered)</DialogTitle>
          </DialogHeader>
          <CssrsForm patientId={patientId} mode="staff" staffName={staffName} staffRole={role} />
        </DialogContent>
      </Dialog>
    </>
  );
}
