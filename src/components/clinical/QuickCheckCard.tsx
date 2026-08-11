// §Adelante Journey Phase 7 part 2 — weekly PHQ-2 / GAD-2 quick check.
// A lightweight gateway INTO the full PHQ-9 / GAD-7 already in this EHR:
// results are stored through the same screener path, and a positive result
// creates real follow-up work rather than a dead-end suggestion.
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { SHORT_FORM_SCREENERS } from "@/lib/screeners";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, CheckCircle2, ClipboardList } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function QuickCheckCard({ patientId }: { patientId: string }) {
  const due = useEhr(() => AdelanteEHR.quickCheckDue(patientId));
  const lastAt = useEhr(() => AdelanteEHR.lastQuickCheckAt(patientId));
  const pending = useEhr(() => AdelanteEHR.pendingFullScreeners(patientId));
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});

  const set = (key: string, idx: number, value: number) =>
    setAnswers((prev) => {
      const arr = [...(prev[key] ?? [])];
      arr[idx] = value;
      return { ...prev, [key]: arr };
    });

  const complete = SHORT_FORM_SCREENERS.every(
    (d) => (answers[d.key]?.filter((v) => v !== undefined).length ?? 0) === d.questions.length,
  );

  const submit = () => {
    const res = AdelanteEHR.recordQuickCheck(patientId, {
      "phq-2": answers["phq-2"] ?? [],
      "gad-2": answers["gad-2"] ?? [],
    });
    setOpen(false);
    setAnswers({});
    if (res.escalated.length > 0) {
      toast.success(
        "Thanks for checking in. We've asked your care team to go through the longer questions with you.",
      );
    } else {
      toast.success("Thanks for checking in.");
    }
  };

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-navy flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-teal" /> Weekly check-in
        </h3>
        {due ? (
          <Badge className="bg-teal/15 text-teal border-0 text-[10px]">Ready for you</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Done this week
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Four short questions about the last two weeks. It takes about a minute.
      </p>

      {pending.length > 0 && (
        <div className="rounded-md border border-gold/40 bg-gold/10 p-3 text-xs space-y-2">
          <div className="flex items-center gap-2 font-medium text-navy">
            <ClipboardList className="h-3.5 w-3.5" /> Your care team has a longer set of questions
            for you
          </div>
          <ul className="space-y-1 text-muted-foreground">
            {pending.map((t) => (
              <li key={t.id}>{t.label}</li>
            ))}
          </ul>
          <Button asChild size="sm" variant="outline" className="min-h-11 text-[11px]">
            <Link to="/intake">Go to the full questions</Link>
          </Button>
        </div>
      )}

      {!open ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {lastAt ? `Last check-in ${new Date(lastAt).toLocaleDateString()}` : "Not done yet"}
          </span>
          <Button
            size="sm"
            className="min-h-11 bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setOpen(true)}
          >
            {due ? "Start check-in" : "Check in again"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {SHORT_FORM_SCREENERS.map((def) => (
            <div key={def.key} className="space-y-2">
              <div className="text-xs font-medium text-navy">{def.description}</div>
              {def.questions.map((q, i) => (
                <div key={q} className="rounded-md border p-2 space-y-2">
                  <div className="text-xs">{q}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {def.options.map((o) => (
                      <Button
                        key={o.value}
                        size="sm"
                        variant={answers[def.key]?.[i] === o.value ? "default" : "outline"}
                        className="min-h-11 text-[11px]"
                        onClick={() => set(def.key, i, o.value)}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-[11px]"
              onClick={() => setOpen(false)}
            >
              Not now
            </Button>
            <Button
              size="sm"
              disabled={!complete}
              className="min-h-11 text-[11px] bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={submit}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Send check-in
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
