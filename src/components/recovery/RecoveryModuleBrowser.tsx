// §Adelante Journey Phase 5b — the patient-facing Recovery Modules surface.
//
// Population gating is Phase 2's, applied through the SAME predicate the
// Library uses (`isLibraryItemVisible` — it takes any `{ populations? }`).
// Recovery content is SUD-population-general by default, like craving/slip;
// only Module 1 is release-specific copy, so only it carries a gate.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Backpack, CheckCircle2, Lock, Map } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n, useRecoveryText } from "@/lib/i18n";
import { usePopulation } from "@/components/PopulationGate";
import { isLibraryItemVisible } from "@/lib/library";
// Resolved through the CONTENT CATALOG so published admin edits reach patients
// without a deployment. See src/lib/contentCatalog.ts.
import {
  liveLessonsInModule,
  liveModuleProgress,
  liveRecoveryLesson,
  liveRecoveryModule,
  liveRecoveryModules,
  usePublishedContentVersion,
} from "@/lib/contentCatalog";
import { RecoveryLessonView } from "./RecoveryLessonView";
import { DaysSoberLine } from "@/components/patient/RecoveryDateCard";

export function RecoveryModuleBrowser({ initialLesson }: { initialLesson?: string } = {}) {
  usePublishedContentVersion();
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
  const openCandidate = openLesson ? liveRecoveryLesson(openLesson) : undefined;
  const openModule = openCandidate ? liveRecoveryModule(openCandidate.moduleId) : undefined;
  const lesson =
    openCandidate && openModule && isLibraryItemVisible(openModule, population)
      ? openCandidate
      : undefined;
  if (lesson) {
    return (
      <PatientPage>
        <Button type="button" variant="ghost" onClick={() => setOpenLesson(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("recBackToModules")}
        </Button>
        <RecoveryLessonView
          lesson={lesson}
          patientId={patientId}
          onDone={() => setOpenLesson(null)}
        />
      </PatientPage>
    );
  }

  return (
    <PatientPage width="browse" className="space-y-6">
      <PatientPageHeader
        icon={Map}
        title={t("recJourneyTitle")}
        lede={t("recJourneyIntro")}
      >
        <DaysSoberLine patientId={patientId} />
        {esPending && (
          <p className="rounded-2xl border border-amber-warm bg-amber-soft p-3 text-sm text-amber-warm-foreground">
            {t("recEsReviewFlag")}
          </p>
        )}
        {/* §Standalone route items — the only entry point to /toolkit, which
            aggregates the Part B picks these lessons write. */}
        <Button asChild variant="outline" className="min-h-11 rounded-2xl">
          <Link to="/toolkit">
            <Backpack className="mr-1 h-4 w-4" aria-hidden="true" /> My toolkit
          </Link>
        </Button>
      </PatientPageHeader>


      {liveRecoveryModules().map((mod) => {
        const gated = !isLibraryItemVisible(mod, population);
        const lessons = liveLessonsInModule(mod.id);
        const prog = liveModuleProgress(mod.id, completed);
        return (
          <Card key={mod.id} className="space-y-4 p-5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-primary">
                  {t("recModuleLabel")} {mod.order}
                </span>
                <h2 className="font-display text-xl text-foreground">
                  {rt(`rec.mod.${mod.id}.name`, mod.name)}
                </h2>
                {mod.reentryFocus && (
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
              <p className="text-sm font-medium text-foreground">
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
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                            {rt(`rec.${l.id}.title`, l.title)}
                            {done && (
                              <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Completed" />
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
    </PatientPage>
  );
}
