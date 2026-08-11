// §Pre-release build 2 — administers a REAL instrument (AUDIT-10, DAST-10,
// AHC-HRSN) from the pre-release checklist.
//
// It renders straight from the shared `ScreenerDef` in `src/lib/screeners.ts`
// and writes through `recordPreReleaseScreener`, which is a thin wrapper over
// the same `recordScreener` path intake uses. There is no scoring here.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type CfAttribution, type PreReleaseEpisode } from "@/lib/ehr";
import { optionsForItem, scoreScreener, screenerByKey } from "@/lib/screeners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PreReleaseScreenerDialog({
  episode,
  screenerKey,
  attribution,
  onClose,
}: {
  episode: PreReleaseEpisode;
  screenerKey: string;
  attribution: CfAttribution;
  onClose: () => void;
}) {
  const def = screenerByKey(screenerKey);
  // Prefill only what this viewer is allowed to read (§Part 2 store gate).
  const existing = useEhr(
    () => AdelanteEHR.viewScreenerResult(episode.patientId, screenerKey).result,
  );
  const [answers, setAnswers] = useState<(number | undefined)[]>(
    () => existing?.responses ?? (def ? def.questions.map(() => undefined) : []),
  );

  if (!def) return null;
  const complete = answers.every((a) => a !== undefined);
  const preview = complete ? scoreScreener(def, answers as number[]) : undefined;

  const save = () => {
    try {
      const r = AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: def.key,
        answers: answers as number[],
        attribution,
      });
      toast.success(`${def.name} recorded — ${r.severity} (${r.score}).`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the screener.");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{def.name}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>
        {existing && (
          <p className="text-xs text-muted-foreground">
            A previous result is on file ({existing.severity}, score {existing.score}). Saving
            records a new result in the screener history.
          </p>
        )}
        <div className="space-y-4">
          {def.questions.map((q, i) => (
            <div key={q} className="space-y-1.5">
              <Label className="text-sm leading-snug">
                {i + 1}. {q}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {optionsForItem(def, i).map((o) => (
                  <Button
                    key={o.label}
                    type="button"
                    size="sm"
                    variant={answers[i] === o.value ? "default" : "outline"}
                    data-testid={`screener-${def.key}-${i}-${o.value}`}
                    onClick={() =>
                      setAnswers((s) => s.map((v, idx) => (idx === i ? o.value : v)))
                    }
                    className="h-auto whitespace-normal py-1 text-left text-xs"
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {preview ? (
              <>
                <Badge variant="secondary" data-testid="screener-preview-score">
                  {preview.score} · {preview.severity}
                </Badge>
                {preview.domains
                  ?.filter((d) => d.positive)
                  .map((d) => (
                    <Badge key={d.key} variant="destructive">
                      {d.label}
                    </Badge>
                  ))}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Answer every item to score.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!complete} data-testid="screener-save" onClick={save}>
              Record result
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
