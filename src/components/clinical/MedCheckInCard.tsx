// §Adelante Journey Phase 7 part 2 — patient medication check-in.
// Rows are REAL derived MAR slots on REAL MedOrders. Marking a dose writes a
// patient self-report (reconciled against the MAR), never a charted dose —
// charting stays staff-only. Tone is encouraging by rule (ADHERENCE_TONE).
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADHERENCE_TONE, type SideEffectSeverity } from "@/lib/medAdherence";
import { marRowLabel } from "@/lib/mar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Pill, Check, HeartHandshake } from "lucide-react";
import { toast } from "sonner";

const SEVERITIES: SideEffectSeverity[] = ["mild", "moderate", "severe"];

export function MedCheckInCard({ patientId }: { patientId: string }) {
  const rows = useEhr(() => AdelanteEHR.patientDoseChecklist(patientId));
  const week = useEhr(() => AdelanteEHR.adherenceWeek(patientId));
  const sideEffects = useEhr(() => AdelanteEHR.listMedSideEffects(patientId));
  const [sfxFor, setSfxFor] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SideEffectSeverity>("mild");
  const [note, setNote] = useState("");

  if (rows.length === 0 && week.every((d) => d.scheduled === 0)) return null;

  const mark = (
    row: (typeof rows)[number],
    status: "taken" | "not_taken",
  ) => {
    AdelanteEHR.selfReportDose(patientId, {
      orderId: row.slot.order.id,
      scheduledAt: row.slot.scheduledAt,
      facilityDate: row.slot.facilityDate,
      status,
    });
    toast.success(status === "taken" ? "Marked as taken" : ADHERENCE_TONE.missedDay);
  };

  const sendSideEffect = (orderId: string) => {
    try {
      AdelanteEHR.reportMedSideEffect(patientId, { orderId, severity, note });
      toast.success("Sent to your care team — someone will follow up with you.");
      setSfxFor(null);
      setNote("");
      setSeverity("mild");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send that.");
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-navy flex items-center gap-2">
        <Pill className="h-4 w-4 text-teal" /> My medicines today
      </h3>
      <p className="text-xs text-muted-foreground">{ADHERENCE_TONE.encouragement}</p>

      {/* Week strip — real scheduled slots vs. what's been marked/charted. */}
      <div className="flex gap-1.5">
        {week.map((d) => {
          const done = d.chartedGiven > 0 || d.selfTaken > 0;
          const none = d.scheduled === 0;
          return (
            <div key={d.dateKey} className="flex-1 text-center">
              <div
                className={`h-8 rounded-md border flex items-center justify-center text-[10px] ${
                  none
                    ? "bg-muted/40 text-muted-foreground"
                    : done
                      ? "bg-success/20 border-success/40 text-success"
                      : "bg-gold/10 border-gold/40 text-navy"
                }`}
                title={none ? "Nothing scheduled" : done ? ADHERENCE_TONE.takenDay : ADHERENCE_TONE.missedDay}
              >
                {none ? "–" : done ? <Check className="h-3.5 w-3.5" /> : "·"}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {new Date(`${d.dateKey}T12:00:00Z`).toLocaleDateString(undefined, {
                  weekday: "narrow",
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.slot.key} className="rounded-md border p-2 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-navy">
                  {marRowLabel(row.slot.order)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.slot.timeLabel}
                  {row.isMat && " · part of your treatment for substance use"}
                </div>
              </div>
              {row.selfReport ? (
                <Badge
                  className={`border-0 text-[10px] ${
                    row.selfReport.status === "taken"
                      ? "bg-success/20 text-success"
                      : "bg-gold/25 text-navy"
                  }`}
                >
                  {row.selfReport.status === "taken"
                    ? ADHERENCE_TONE.takenDay
                    : ADHERENCE_TONE.missedDay}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  {ADHERENCE_TONE.notYet}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={row.selfReport?.status === "taken" ? "default" : "outline"}
                className="min-h-11 text-[11px]"
                onClick={() => mark(row, "taken")}
              >
                I took it
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 text-[11px]"
                onClick={() => mark(row, "not_taken")}
              >
                Not yet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 text-[11px]"
                onClick={() =>
                  setSfxFor((cur) => (cur === row.slot.order.id ? null : row.slot.order.id))
                }
              >
                <HeartHandshake className="h-3.5 w-3.5 mr-1" /> Report a side effect
              </Button>
            </div>
            {sfxFor === row.slot.order.id && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                <div className="flex gap-1.5">
                  {SEVERITIES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={severity === s ? "default" : "outline"}
                      className="min-h-11 text-[11px] capitalize"
                      onClick={() => setSeverity(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you notice? (for example: upset stomach, trouble sleeping)"
                  className="min-h-[60px] text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="min-h-11 text-[11px] bg-teal text-teal-foreground hover:bg-teal/90"
                    onClick={() => sendSideEffect(row.slot.order.id)}
                  >
                    Send to my care team
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {sideEffects.length > 0 && (
        <div className="text-[11px] text-muted-foreground space-y-1">
          <div className="font-medium text-navy">Side effects you've reported</div>
          {sideEffects.map((s) => (
            <div key={s.id}>
              {s.drugName} · {s.severity} ·{" "}
              {s.acknowledgedAt ? "your care team has seen this" : "sent to your care team"}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
