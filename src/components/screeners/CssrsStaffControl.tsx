import { StatusChip } from "@/components/ui/status-chip";
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



export function CssrsRiskBadge({ risk }: { risk?: CssrsRisk }) {
  if (!risk) return null;
  // Default per published guidance; pending clinical review (Dr. Bagga)
  return risk === "none" ? <span className="text-sm text-ink-muted" data-testid="cssrs-risk-badge">C-SSRS: {CSSRS_RISK_LABEL[risk]}</span> : <StatusChip lang="en" state={risk === "high" ? "urgent" : risk === "moderate" ? "yourturn" : "upnext"} label={risk === "high" ? "High risk — act now" : risk === "moderate" ? "Moderate risk — review" : `C-SSRS: ${CSSRS_RISK_LABEL[risk]}`} data-testid="cssrs-risk-badge" />;
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
        <StatusChip lang="en" state="yourturn" label="C-SSRS indicated" data-testid="cssrs-requested" />
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
