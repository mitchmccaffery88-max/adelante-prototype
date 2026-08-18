// §5-stage recovery journey — the one shared surface for viewing and setting
// the stage. Rendered for the patient (on Home) and for the care team (in the
// care-plan tab of the chart) from the same component, so the two views can
// never drift apart on what the model says.
//
// Nothing here computes a stage. The timeline highlights whatever the last
// audited entry says, and the signals are reference content the person reads
// for themselves — see the header comment in `src/lib/recoveryStages.ts`.
import { useState } from "react";
import { Check, Circle, PencilLine, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  RECOVERY_STAGES,
  RECOVERY_STAGE_REVIEW,
  recoveryStage,
  type RecoveryStageId,
} from "@/lib/recoveryStages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The visible, non-blocking pending-review notice. */
export function RecoveryStageReviewNotice({ className }: { className?: string }) {
  if (!RECOVERY_STAGE_REVIEW.pending) return null;
  return (
    <p
      data-testid="recovery-stage-review-notice"
      className={cn(
        "flex items-start gap-1.5 rounded-xl bg-muted px-2.5 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{RECOVERY_STAGE_REVIEW.notice}</span>
    </p>
  );
}

function Timeline({ current }: { current?: RecoveryStageId }) {
  const currentOrder = current ? recoveryStage(current).order : 0;
  return (
    <ol className="flex items-stretch gap-1" data-testid="recovery-stage-timeline">
      {RECOVERY_STAGES.map((s) => {
        const isCurrent = s.id === current;
        const isPast = s.order < currentOrder;
        return (
          <li key={s.id} className="min-w-0 flex-1" data-stage={s.id} data-current={isCurrent}>
            <div
              className={cn(
                "h-1.5 rounded-full",
                isCurrent ? "bg-primary" : isPast ? "bg-primary/40" : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-1.5 block truncate text-[10px] leading-tight",
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
              title={s.label}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function RecoveryStagePanel({
  patientId,
  actor,
  actorName,
  actorRole,
  readOnly,
  compact,
}: {
  patientId: string;
  actor: "patient" | "staff";
  actorName: string;
  actorRole?: string;
  readOnly?: boolean;
  /** Home-tile density: current stage's signals only, others behind the dialog. */
  compact?: boolean;
}) {
  const entry = useEhr(() => AdelanteEHR.getRecoveryStage(patientId));
  const history = useEhr(() => AdelanteEHR.recoveryStageHistory(patientId));
  const current = entry?.stage;
  const stage = current ? recoveryStage(current) : undefined;

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<RecoveryStageId | undefined>(current);
  const [note, setNote] = useState("");

  function save() {
    if (!picked) return;
    try {
      AdelanteEHR.setRecoveryStage({
        patientId,
        stage: picked,
        setBy: { actor, name: actorName, ...(actorRole ? { role: actorRole } : {}) },
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setNote("");
      setOpen(false);
      toast.success(`Stage set to ${recoveryStage(picked).label}`, {
        description: "You can change this any time — it's a self-check, not a score.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the stage.");
    }
  }

  return (
    <div className="space-y-3" data-testid="recovery-stage-panel">
      <Timeline {...(current ? { current } : {})} />

      {stage ? (
        <div>
          <p className="text-sm font-semibold text-foreground" data-testid="recovery-stage-current">
            Right now: {stage.label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{stage.blurb}</p>
          <ul className="mt-2 space-y-1" data-testid="recovery-stage-signals">
            {stage.signals.map((sig) => (
              <li key={sig} className="flex items-start gap-1.5 text-xs text-foreground">
                <Circle className="mt-1 h-2 w-2 shrink-0 fill-primary/40 text-primary/40" aria-hidden="true" />
                <span>{sig}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Set by {entry?.setByActor === "patient" ? "you" : entry?.setByName}
            {entry?.setByActor === "staff" && entry?.setByRole ? ` (${entry.setByRole})` : ""} ·{" "}
            {new Date(entry?.at ?? "").toLocaleDateString()}
            {history.length > 1 ? ` · ${history.length} updates` : ""}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="recovery-stage-unset">
          {actor === "patient"
            ? "No stage picked yet. Read the five stages and choose the one that sounds like where you actually are."
            : "No stage recorded yet. The patient or the care team can set one."}
        </p>
      )}

      {!compact && (
        <ul className="space-y-2">
          {RECOVERY_STAGES.filter((s) => s.id !== current).map((s) => (
            <li key={s.id} className="rounded-xl border p-2.5">
              <p className="text-xs font-medium text-foreground">{s.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.signals.join(" · ")}</p>
            </li>
          ))}
        </ul>
      )}

      <RecoveryStageReviewNotice />

      {!readOnly && (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setPicked(current);
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="min-h-11 w-full rounded-2xl"
              data-testid="recovery-stage-update"
            >
              <PencilLine className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {current ? "Update where you are" : "Pick where you are"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Where are you right now?</DialogTitle>
              <DialogDescription>
                Nobody scores this and nothing decides it for you. Pick the stage that sounds most
                like your life this week — you can change it whenever it changes.
              </DialogDescription>
            </DialogHeader>
            <RecoveryStageReviewNotice />
            <div className="space-y-2">
              {RECOVERY_STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`recovery-stage-option-${s.id}`}
                  onClick={() => setPicked(s.id)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition",
                    picked === s.id ? "border-primary bg-primary/5" : "hover:bg-secondary",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {picked === s.id && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.blurb}</span>
                  <ul className="mt-1.5 space-y-0.5">
                    {s.signals.map((sig) => (
                      <li key={sig} className="text-[11px] text-muted-foreground">
                        · {sig}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything you want to remember about why (optional)"
              className="min-h-[70px]"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={!picked} data-testid="recovery-stage-save">
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
