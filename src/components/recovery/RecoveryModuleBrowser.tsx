// §Adelante Journey Phase 5b — the patient-facing Recovery Modules surface.
//
// Population gating is Phase 2's, applied through the SAME predicate the
// Library uses (`isLibraryItemVisible` — it takes any `{ populations? }`).
// Recovery content is SUD-population-general by default, like craving/slip;
// only Module 1 is release-specific copy, so only it carries a gate.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { usePopulation } from "@/components/PopulationGate";
import { isLibraryItemVisible } from "@/lib/library";
import {
  LIVING_RECOVERY_WRAPPER,
  RECOVERY_MODULES,
  getRecoveryLesson,
  lessonsInModule,
  moduleProgress,
} from "@/lib/recovery";
import { RecoveryLessonView } from "./RecoveryLessonView";

export function RecoveryModuleBrowser({ initialLesson }: { initialLesson?: string } = {}) {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const population = usePopulation(patientId);
  const completed = useEhr(() =>
    patientId ? AdelanteEHR.completedRecoveryLessons(patientId) : [],
  );
  const [openLesson, setOpenLesson] = useState<string | null>(initialLesson ?? null);

  if (!patientId) return null;

  const lesson = openLesson ? getRecoveryLesson(openLesson) : undefined;
  if (lesson) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Button type="button" variant="ghost" onClick={() => setOpenLesson(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to my modules
        </Button>
        <RecoveryLessonView
          lesson={lesson}
          patientId={patientId}
          onDone={() => setOpenLesson(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-navy">My recovery journey</h1>
        <p className="text-muted-foreground">
          Eight modules, each with its own mission. Work them in order or start where you are.
        </p>
      </header>

      {RECOVERY_MODULES.map((mod) => {
        const gated = !isLibraryItemVisible(mod, population);
        const lessons = lessonsInModule(mod.id);
        const prog = moduleProgress(mod.id, completed);
        return (
          <Card key={mod.id} className="space-y-4 p-5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-teal">
                  Module {mod.order}
                </span>
                <h2 className="font-display text-xl text-navy">{mod.name}</h2>
                {mod.populations && (
                  <Badge variant="outline" className="text-[10px]">
                    Reentry-specific
                  </Badge>
                )}
                {mod.contentPending && (
                  <Badge variant="outline" className="border-gold text-[10px] text-gold-foreground">
                    Lesson content pending transcription
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-navy">Mission: {mod.mission}</p>
              <p className="text-sm text-muted-foreground">{mod.subtitle}</p>
            </div>

            {gated ? (
              <p className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" aria-hidden /> This module is written for people coming
                out of custody. It isn&apos;t part of your track.
              </p>
            ) : mod.contentPending ? (
              <p className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                This module is real and confirmed, but its lessons haven&apos;t been transcribed
                yet. Nothing has been made up to fill the gap — it will open when the real content
                lands.
              </p>
            ) : (
              <>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {prog.completed} of {prog.total} finished
                    </span>
                    <span>{prog.pct}%</span>
                  </div>
                  <Progress value={prog.pct} className="h-2" />
                </div>
                <ul className="divide-y">
                  {lessons.map((l) => {
                    const done = completed.includes(l.id);
                    return (
                      <li key={l.id} className="flex items-center gap-3 py-2.5">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy">
                            {l.title}
                            {done && (
                              <CheckCircle2 className="h-4 w-4 text-teal" aria-label="Completed" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{l.minutes} min</div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenLesson(l.id)}
                        >
                          {done ? "Revisit" : "Start"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        );
      })}

      <Card className="space-y-1 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl text-navy">{LIVING_RECOVERY_WRAPPER.name}</h2>
          <Badge variant="outline" className="border-gold text-[10px] text-gold-foreground">
            Not yet confirmed as a module
          </Badge>
        </div>
        <p className="text-sm font-medium text-navy">
          Mission: {LIVING_RECOVERY_WRAPPER.mission}
        </p>
        <p className="text-sm text-muted-foreground">
          {LIVING_RECOVERY_WRAPPER.subtitle} We&apos;ve kept this as a closing section over the
          eight modules rather than building it as a ninth — that needs a human decision before any
          lessons are written for it.
        </p>
      </Card>
    </div>
  );
}
