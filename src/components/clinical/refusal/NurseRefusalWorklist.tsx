// Cross-patient nurse worklist for refusal legal documents.
//
// The MAR tab only shows the current patient's pending forms; a nurse who
// charted refusals across several patients had no single surface to finish
// them. This card lists every pending document, opens the same
// RefusalFormDialog, and carries the 3-in-7-day escalation through on
// finalize so the worklist path has identical rigor to the MAR path.

import { useState } from "react";
import { AdelanteEHR, useEhr, type RefusalForm } from "@/lib/ehr";
import { marRowLabel } from "@/lib/mar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { FileSignature } from "lucide-react";
import { RefusalFormDialog } from "./RefusalFormDialog";
import { RefusalEscalationDialog } from "./RefusalEscalationDialog";

type EscalationTarget = {
  patientId: string;
  formId: string;
  orderId: string;
  drugName: string;
  medClass: RefusalForm["medClass"];
  refusalCount: number;
};

export function NurseRefusalWorklist({
  staffName,
  readOnly = false,
  patientId,
}: {
  staffName: string;
  readOnly?: boolean;
  /** Optional scope — omit for the full cross-patient worklist. */
  patientId?: string;
}) {
  const rows = useEhr(() => AdelanteEHR.listPendingRefusalForms({ patientId }));
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [escalation, setEscalation] = useState<EscalationTarget | null>(null);

  const active = rows.find((r) => r.form.id === openFormId) ?? null;

  const handleFinalized = (form: RefusalForm, orderId: string) => {
    const target = rows.find((r) => r.form.id === form.id);
    setOpenFormId(null);
    if (!target || !orderId) return;
    const pid = target.patient.id;
    if (AdelanteEHR.refusalEscalationDue(pid, orderId)) {
      setEscalation({
        patientId: pid,
        formId: form.id,
        orderId,
        drugName: target.order?.productName ?? target.order?.drugName ?? "This medication",
        medClass: form.medClass,
        refusalCount: AdelanteEHR.refusalsInWindow(pid, orderId).length,
      });
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-navy">Refusal documents to sign</h3>
        <Badge variant={rows.length ? "destructive" : "outline"}>{rows.length}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The refusals themselves are already charted on the MAR. These are the separate legal
        documents — they stay here, oldest first, until finalized.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing awaiting signature.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map(({ form, patient, order, administration }) => (
            <div
              key={form.id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs"
            >
              <span className="font-medium">
                {patient.firstName} {patient.lastName}
              </span>
              <span className="text-muted-foreground">
                {order ? marRowLabel(order) : "Refused medication"}
              </span>
              <Badge variant="outline">
                {form.medClass === "*" ? "general" : form.medClass}
              </Badge>
              <span className="text-muted-foreground">
                refused <ClientDate value={administration?.chartedAt ?? form.createdAt} />
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={readOnly}
                onClick={() => setOpenFormId(form.id)}
              >
                Open &amp; sign
              </Button>
            </div>
          ))}
        </div>
      )}

      {active && (
        <RefusalFormDialog
          patientId={active.patient.id}
          form={active.form}
          staffName={staffName}
          onClose={() => setOpenFormId(null)}
          onFinalized={handleFinalized}
        />
      )}

      {escalation && (
        <RefusalEscalationDialog
          patientId={escalation.patientId}
          target={escalation}
          staffName={staffName}
          onClose={() => setEscalation(null)}
        />
      )}
    </Card>
  );
}