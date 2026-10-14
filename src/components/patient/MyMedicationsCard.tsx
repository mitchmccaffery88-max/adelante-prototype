import { StatusChip } from "@/components/ui/status-chip";
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
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.2bb6b986c5d6": {
    "en": "active",
    "es": "activo"
  },
  "ui.7f5bacad58ce": {
    "en": "Request refill",
    "es": "Solicitar renovación"
  },
  "ui.faf97fdcf0fc": {
    "en": "Note for your prescriber (optional) — e.g. pharmacy name, ran out early",
    "es": "Nota para quien receta (opcional), por ejemplo: nombre de la farmacia o se me acabó antes"
  },
  "ui.77dfd2135f4d": {
    "en": "Cancel",
    "es": "Cancelar"
  },
  "ui.a89d64179469": {
    "en": "Send request",
    "es": "Enviar solicitud"
  },
  "ui.c7ca65b17eae": {
    "en": "Prescriber note:",
    "es": "Nota de quien receta:"
  },
  "ui.6deaed92d12f": {
    "en": "My medications",
    "es": "Mis medicamentos"
  },
  "ui.7f3e9658d048": {
    "en": "Managed with your care team through eScribe.",
    "es": "Se coordina con tu equipo de cuidado a través de eScribe."
  },
  "ui.4b08399f2919": {
    "en": "Demo data · prototype prescriptions — no real e-prescribing.",
    "es": "Datos de demostración · recetas de prueba; no se envían recetas reales."
  },
  "ui.0343fde56f51": {
    "en": "Nothing prescribed through Adelante right now.",
    "es": "Por ahora no tienes medicamentos recetados por Adelante."
  },
  "ui.8f13373a9e5f": {
    "en": "Questions about your medication? Message your care team.",
    "es": "¿Dudas sobre tu medicina? Escríbele a tu equipo."
  }
} as const;


function MedRow({ med, patientId }: { med: Medication; patientId: string }) {
  const { lang: screenLang } = useI18n();

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
        : latest.status === "needs_appointment"
          ? { label: "Appointment needed first", cls: "bg-gold/30 text-navy" }
          : { label: "Refill denied", cls: "bg-surface-sunk text-attention" }
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
            {med.indication ? ` · for ${med.indication}` : ""}
          </div>
          {(med.refillsRemaining !== undefined || med.pharmacy) && (
            <div className="text-[11px] text-muted-foreground">
              {med.refillsRemaining !== undefined &&
                `${med.refillsRemaining} refill${med.refillsRemaining === 1 ? "" : "s"} left`}
              {med.refillsRemaining !== undefined && med.pharmacy ? " · " : ""}
              {med.pharmacy}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusBadge ? (
            <StatusChip state={latest?.status === "pending" ? "team" : latest?.status === "approved" || latest?.status === "sent_to_pharmacy" ? "done" : "yourturn"} label={statusBadge.label} />
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {SCREEN_COPY["ui.2bb6b986c5d6"][screenLang]} </Badge>
          )}
          {(!latest || latest.status !== "pending") && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 min-w-11 text-[11px]"
              onClick={() => setOpen((v) => !v)}
            >
              {SCREEN_COPY["ui.7f5bacad58ce"][screenLang]} </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={SCREEN_COPY["ui.faf97fdcf0fc"][screenLang]}
            className="min-h-[60px] text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-[11px]"
              onClick={() => setOpen(false)}
            >
              {SCREEN_COPY["ui.77dfd2135f4d"][screenLang]} </Button>
            <Button
              size="sm"
              className="min-h-11 bg-teal text-[11px] text-teal-foreground hover:bg-teal/90"
              onClick={submit}
            >
              {SCREEN_COPY["ui.a89d64179469"][screenLang]} </Button>
          </div>
        </div>
      )}
      {latest?.denyReason && (latest.status === "denied" || latest.status === "needs_appointment") && (
        <div className="mt-1 text-sm text-ink-muted">
          {SCREEN_COPY["ui.c7ca65b17eae"][screenLang]} {latest.denyReason}
        </div>
      )}
    </li>
  );
}

export function MyMedicationsCard({ patientId }: { patientId: string }) {
  const { lang: screenLang } = useI18n();

  const meds = useEhr(() => AdelanteEHR.listMedications(patientId));
  return (
    <Card className="p-5" id="my-medications" data-testid="my-medications-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Pill className="h-4 w-4" /> {SCREEN_COPY["ui.6deaed92d12f"][screenLang]} </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {SCREEN_COPY["ui.7f3e9658d048"][screenLang]} </p>
      {meds.some((m) => m.demo) && (
        <p className="mt-1 text-[10px] text-muted-foreground" data-testid="meds-demo-label">
          {SCREEN_COPY["ui.4b08399f2919"][screenLang]} </p>
      )}
      {meds.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.0343fde56f51"][screenLang]} </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {meds.map((m) => (
            <MedRow key={m.id} med={m} patientId={patientId} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        {SCREEN_COPY["ui.8f13373a9e5f"][screenLang]} </p>
    </Card>
  );
}
