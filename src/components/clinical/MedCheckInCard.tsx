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

// §Build A item 6 — time-of-day grouping for today's doses. Derived from the
// slot's own scheduled time, so it follows the real MAR schedule.
const GROUPS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
] as const;

function timeOfDay(scheduledAt: string): (typeof GROUPS)[number]["id"] {
  const h = new Date(scheduledAt).getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

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

      {/* §Build A item 6 — week strip. It used to render an unlabelled "–" for
          every day, because the only visible glyphs were "–" (nothing
          scheduled), a check, and a bare "·" for everything else — with no
          legend to read them by. Cells now carry a real short status word and
          the legend below names all four states. Data source is unchanged. */}
      <div>
        <div className="flex gap-1.5" data-testid="adherence-week-strip">
          {week.map((d, i) => {
            const done = d.chartedGiven > 0 || d.selfTaken > 0;
            const none = d.scheduled === 0;
            const isToday = i === week.length - 1;
            const state = none ? "none" : done ? "taken" : isToday ? "upcoming" : "missed";
            const cell = {
              none: { cls: "bg-muted/40 text-muted-foreground", label: "—", title: "Nothing scheduled" },
              taken: {
                cls: "bg-success/20 border-success/40 text-success",
                label: "Taken",
                title: ADHERENCE_TONE.takenDay,
              },
              upcoming: {
                cls: "bg-secondary border-border text-foreground",
                label: "Due",
                title: "Still to mark today",
              },
              missed: {
                cls: "bg-gold/15 border-gold/50 text-navy",
                label: "Missed",
                title: ADHERENCE_TONE.missedDay,
              },
            }[state];
            return (
              <div key={d.dateKey} className="flex-1 text-center">
                <div
                  data-testid={`adherence-day-${state}`}
                  className={`h-9 rounded-md border flex items-center justify-center gap-0.5 text-[10px] font-medium ${cell.cls}`}
                  title={cell.title}
                >
                  {state === "taken" && <Check className="h-3 w-3" aria-hidden="true" />}
                  {cell.label}
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
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <li className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-success/40 bg-success/20" /> Taken
          </li>
          <li className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border border-gold/50 bg-gold/15" /> Missed
          </li>
          <li className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border bg-secondary" /> Still to mark
          </li>
          <li className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> Nothing scheduled
          </li>
        </ul>
      </div>

      {/* §Build A item 6 — today's doses grouped under real Morning /
          Afternoon / Evening headers instead of a flat list of timestamps. */}
      {GROUPS.map((group) => {
        const groupRows = rows.filter((r) => timeOfDay(r.slot.scheduledAt) === group.id);
        if (groupRows.length === 0) return null;
        return (
          <div key={group.id} className="space-y-2" data-testid={`dose-group-${group.id}`}>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h4>
            <ul className="space-y-2">
        {groupRows.map((row) => (
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
          </div>
        );
      })}

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
