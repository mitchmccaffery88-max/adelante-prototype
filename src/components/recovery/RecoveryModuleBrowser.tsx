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
import { useI18n, useRecoveryText } from "@/lib/i18n";
import { usePopulation } from "@/components/PopulationGate";
import { isLibraryItemVisible } from "@/lib/library";
import {
  RECOVERY_MODULES,
  getRecoveryLesson,
  getRecoveryModule,
  lessonsInModule,
  moduleProgress,
} from "@/lib/recovery";
import { RecoveryLessonView } from "./RecoveryLessonView";

export function RecoveryModuleBrowser({ initialLesson }: { initialLesson?: string } = {}) {
  const { t } = useI18n();
  const { rt, esPending } = useRecoveryText();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const population = usePopulation(patientId);
  const completed = useEhr(() =>
    patientId ? AdelanteEHR.completedRecoveryLessons(patientId) : [],
  );
  const [openLesson, setOpenLesson] = useState<string | null>(initialLesson ?? null);

  if (!patientId) return null;

  // A deep-linked `?lesson=` must obey the same Phase 2 gate as the list —
  // the gate lives on the MODULE, so resolve it before rendering the lesson.
  const openCandidate = openLesson ? getRecoveryLesson(openLesson) : undefined;
  const openModule = openCandidate ? getRecoveryModule(openCandidate.moduleId) : undefined;
  const lesson =
    openCandidate && openModule && isLibraryItemVisible(openModule, population)
      ? openCandidate
      : undefined;
  if (lesson) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Button type="button" variant="ghost" onClick={() => setOpenLesson(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("recBackToModules")}
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
        <h1 className="font-display text-3xl text-navy">{t("recJourneyTitle")}</h1>
        <p className="text-muted-foreground">{t("recJourneyIntro")}</p>
        {esPending && (
          <p className="rounded-lg border border-gold bg-gold/5 p-3 text-xs text-muted-foreground">
            {t("recEsReviewFlag")}
          </p>
        )}
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
                  {t("recModuleLabel")} {mod.order}
                </span>
                <h2 className="font-display text-xl text-navy">
                  {rt(`rec.mod.${mod.id}.name`, mod.name)}
                </h2>
                {mod.populations && (
                  <Badge variant="outline" className="text-[10px]">
                    {t("recReentrySpecific")}
                  </Badge>
                )}
                {mod.contentPending && (
                  <Badge variant="outline" className="border-gold text-[10px] text-gold-foreground">
                    {t("recPendingBadge")}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-navy">
                {t("recMissionLabel")}: {rt(`rec.mod.${mod.id}.mission`, mod.mission)}
              </p>
              <p className="text-sm text-muted-foreground">
                {rt(`rec.mod.${mod.id}.subtitle`, mod.subtitle)}
              </p>
              {/* A module with no transcribed lessons reports its REAL count
                  (zero) rather than a 0-of-0 fraction that would read like a
                  stalled module. Modules WITH lessons show the real fraction
                  next to the progress bar below instead. */}
              {prog.total === 0 && (
                <p className="text-xs text-muted-foreground">{t("recPendingProgress")}</p>
              )}
            </div>

            {gated ? (
              <p className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" aria-hidden /> {t("recGatedBody")}
              </p>
            ) : mod.contentPending ? (
              <p className="rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
                {t("recPendingBody")}
              </p>
            ) : (
              <>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {prog.completed} {t("recProgressOf")} {prog.total} {t("recProgressLessons")}
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
                            {rt(`rec.${l.id}.title`, l.title)}
                            {done && (
                              <CheckCircle2 className="h-4 w-4 text-teal" aria-label="Completed" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {l.minutes} {t("recMinutesShort")}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenLesson(l.id)}
                        >
                          {done ? t("recRevisit") : t("recStart")}
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
          <h2 className="font-display text-xl text-navy">{t("recLivingName")}</h2>
          <Badge variant="outline" className="border-gold text-[10px] text-gold-foreground">
            {t("recLivingBadge")}
          </Badge>
        </div>
        <p className="text-sm font-medium text-navy">
          {t("recMissionLabel")}: {t("recLivingMission")}
        </p>
        <p className="text-sm text-muted-foreground">{t("recLivingBody")}</p>
      </Card>
    </div>
  );
}
