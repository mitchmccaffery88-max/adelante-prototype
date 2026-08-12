// §P1 My Care de-clutter — the real "My medications" list, moved off My Care.
//
// Lifted verbatim from `PatientHome`: same `AdelanteEHR.requestRefill` call,
// same refill-status badges, same crisis scan of the free-text note to the
// prescriber. It now lives on the Medication surface next to the Today
// tracker, instead of being a second medication block on My Care.
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "lucide-react";
import { AdelanteEHR, useEhr, type Medication } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";

function MedRow({ med, patientId }: { med: Medication; patientId: string }) {
  const requests = useEhr(() =>
    AdelanteEHR.listRefillRequests({ patientId }).filter((r) => r.medicationId === med.id),
  );
  const latest = requests[0];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const submit = () => {
    const req = AdelanteEHR.requestRefill({
      patientId,
      medicationId: med.id,
      pharmacyNote: note.trim() || undefined,
      requestedBy: "patient",
    });
    if (req) {
      scanTextForCrisis(patientId, note, { surface: "a refill request note" });
      toast.success("Refill request sent to your care team");
      setOpen(false);
      setNote("");
    } else {
      toast.error("Could not send that request.");
    }
  };

  const statusBadge = latest
    ? latest.status === "pending"
      ? { label: "Refill pending", cls: "bg-gold/30 text-navy" }
      : latest.status === "sent_to_pharmacy" || latest.status === "approved"
        ? { label: "Refill approved", cls: "bg-success/20 text-success" }
        : { label: "Refill denied", cls: "bg-destructive/15 text-destructive" }
    : null;

  return (
    <li className="border-b pb-2 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-navy">
            {med.name} <span className="font-normal text-muted-foreground">· {med.dose}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {med.frequency} · {med.prescriber}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusBadge ? (
            <Badge
              className={`${statusBadge.cls} border-0 text-[10px]`}
              title={latest?.denyReason ?? undefined}
            >
              {statusBadge.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              active
            </Badge>
          )}
          {(!latest || latest.status === "denied") && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 min-w-11 text-[11px]"
              onClick={() => setOpen((v) => !v)}
            >
              Request refill
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for your prescriber (optional) — e.g. pharmacy name, ran out early"
            className="min-h-[60px] text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-[11px]"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="min-h-11 bg-teal text-[11px] text-teal-foreground hover:bg-teal/90"
              onClick={submit}
            >
              Send request
            </Button>
          </div>
        </div>
      )}
      {latest?.denyReason && latest.status === "denied" && (
        <div className="mt-1 text-[10px] text-destructive">
          Prescriber note: {latest.denyReason}
        </div>
      )}
    </li>
  );
}

export function MyMedicationsCard({ patientId }: { patientId: string }) {
  const meds = useEhr(() => AdelanteEHR.listMedications(patientId));
  return (
    <Card className="p-5" id="my-medications" data-testid="my-medications-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Pill className="h-4 w-4" /> My medications
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Managed with your care team through eScribe.
      </p>
      {meds.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Nothing prescribed through Adelante right now.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {meds.map((m) => (
            <MedRow key={m.id} med={m} patientId={patientId} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Questions about your medication? Message your care team.
      </p>
    </Card>
  );
}
