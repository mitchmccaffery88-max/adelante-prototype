// §Adelante Journey Phase 5 — the patient-facing Library surface.
//
// Population gating is Phase 2's: `usePopulation` resolves the viewer's track
// from the REAL record and `visibleItemsInCategory` drops any lesson whose
// copy is written for a population this person is not in. Most of the library
// carries no gate at all and is shown to everyone.
import { completePlayerExercise } from "@/lib/patientPlayerActions";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock, Wrench, X } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { usePopulation } from "@/components/PopulationGate";
import { getExercise, visibleExercises } from "@/lib/library";
import { resolveContentIcon } from "@/lib/contentIcons";
import { activityKindLabel, categoryEyebrow } from "@/lib/contentDisplay";
// Lessons resolve through the CONTENT CATALOG, not the raw baseline module:
// a published admin edit or a newly published lesson must reach patients
// without a deployment. Exercises are not admin-managed yet, so they still
// come straight from the baseline.
import {
  liveLibraryCategories,
  liveCategoryProgress,
  liveLibraryItem, liveExercise, liveExercises,
  liveVisibleItemsInCategory,
  usePublishedContentVersion,
} from "@/lib/contentCatalog";
import { LibraryLesson } from "./LibraryLesson";
import { ExerciseBody } from "./ExercisePlayer";
import { toast } from "sonner";
/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.1798b3ba42ee": {
    "en": "Completed",
    "es": "Completado"
  },
  "ui.633b9dd389ea": {
    "en": "Placeholder content",
    "es": "Contenido provisional"
  },
  "ui.6b21fb791ac0": {
    "en": "About",
    "es": "Acerca de"
  },
  "ui.be2e2bb698c7": {
    "en": "minutes",
    "es": "minutos"
  },
  "ui.d4ec572643e2": {
    "en": "Real tools for real moments.",
    "es": "Herramientas reales para momentos reales."
  },
  "ui.cb9ce97bfc9a": {
    "en": "Lessons",
    "es": "Lecciones"
  },
  "ui.4dc503dafcf2": {
    "en": "Exercises",
    "es": "Ejercicios"
  },
  "ui.a0c39ab06f61": {
    "en": "My toolkit",
    "es": "Mi caja de herramientas"
  },
  "ui.1e8c09c8a3d6": {
    "en": "All collections",
    "es": "Todas las colecciones"
  },
  "ui.de04fa0e29f9": {
    "en": "of",
    "es": "de"
  },
  "ui.f957097d7a22": {
    "en": "finished",
    "es": "terminado"
  },
  "ui.b48cc15f8db9": {
    "en": "Reentry-specific",
    "es": "Específico de reinserción"
  },
  "ui.b6c935d4f3c7": {
    "en": "min",
    "es": "min"
  },
  "ui.b11449a34df8": {
    "en": "lesson",
    "es": "lección"
  },
  "ui.e5fd9cfe0e80": {
    "en": "done",
    "es": "listo"
  },
  "ui.7db2208cc987": {
    "en": "min · Open",
    "es": "min · Abrir"
  },
  "ui.66eead64fb66": {
    "en": "Nothing saved yet. Finishing a lesson or an exercise puts its takeaway here.",
    "es": "Aún no hay nada guardado. Al terminar una lección o ejercicio, verás el resumen aquí."
  },
  "ui.3f66052a107e": {
    "en": "From",
    "es": "De"
  }
} as const;


export function LibraryBrowser({
  initialExercise,
  initialItem,
}: { initialExercise?: string; initialItem?: string } = {}) {
  const { lang: screenLang } = useI18n();

  usePublishedContentVersion();
  const { t } = useI18n();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const population = usePopulation(patientId);
  const completedItems = useEhr(() => AdelanteEHR.completedLibraryItems(patientId));
  const completedExercises = useEhr(() => AdelanteEHR.completedExercises(patientId));
  const toolkit = useEhr(() => AdelanteEHR.savedToolkitItems(patientId));
  const [openItem, setOpenItem] = useState<string | null>(initialItem ?? null);
  const [openExercise, setOpenExercise] = useState<string | null>(initialExercise ?? null);
  // Build C: the lessons tab is an INDEX first. `openCategory` is the only
  // new navigation state — a category's item list is the same list markup
  // that used to be expanded inline, just gated behind a tap.
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  if (!patientId) return null;

  const lesson = openItem ? liveLibraryItem(openItem) : undefined;
  const exercise = openExercise ? liveExercise(openExercise) : undefined;

  if (lesson) {
    return (
      <PatientPage>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpenCategory(lesson.categoryId);
            setOpenItem(null);
          }}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("playerLibraryBack")}
        </Button>
        <LibraryLesson
          item={lesson}
          patientId={patientId}
          onDone={() => {
            setOpenCategory(lesson.categoryId);
            setOpenItem(null);
          }}
        />
      </PatientPage>
    );
  }

  if (exercise) {
    const done = completedExercises.includes(exercise.id);
    return (
      <PatientPage>
        <Button type="button" variant="ghost" onClick={() => setOpenExercise(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("playerLibraryBack")}
        </Button>
        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-semibold text-2xl text-foreground">{exercise.title}</h1>
              {done && (
                <Badge className="border-0 bg-accent text-accent-foreground">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {SCREEN_COPY["ui.1798b3ba42ee"][screenLang]} </Badge>
              )}
              {exercise.placeholder && (
                <Badge variant="outline" className="border-amber-warm text-amber-warm-foreground">
                  {SCREEN_COPY["ui.633b9dd389ea"][screenLang]} </Badge>
              )}
            </div>
            <p className="text-sm text-foreground">{exercise.subtitle}</p>
            <div className="flex items-center gap-1.5 text-xs text-foreground">
              <Clock className="h-3.5 w-3.5" /> {SCREEN_COPY["ui.6b21fb791ac0"][screenLang]} {exercise.minutes} {SCREEN_COPY["ui.be2e2bb698c7"][screenLang]} </div>
          </div>
          <p className="rounded-2xl bg-secondary/50 p-3 text-sm text-foreground">{exercise.purpose}</p>
          <ExerciseBody exercise={exercise} />
          <Button
            type="button"
            onClick={() => {
              completePlayerExercise(patientId, exercise.id);
              toast.success(t("playerComplete"));
              setOpenExercise(null);
            }}
          >
            {t("playerFinish")}
          </Button>
        </Card>
      </PatientPage>
    );
  }

  const exercises = liveExercises().filter((e) => !e.populations?.length || e.populations.includes(population.track));

  return (
    <PatientPage width="browse" className="space-y-6">
      <PatientPageHeader
        icon={BookOpen}
        eyebrow="Self-help learning library"
        title={SCREEN_COPY["ui.d4ec572643e2"][screenLang]}
        lede="Short lessons and practical exercises — most take 2 to 10 minutes. Work through a collection in order or open whatever fits today. It's yours to use for as long as you need it."
      />

      <Tabs defaultValue="lessons">
        <TabsList>
          <TabsTrigger value="lessons">{SCREEN_COPY["ui.cb9ce97bfc9a"][screenLang]}</TabsTrigger>
          <TabsTrigger value="exercises">{SCREEN_COPY["ui.4dc503dafcf2"][screenLang]}</TabsTrigger>
          <TabsTrigger value="toolkit">{SCREEN_COPY["ui.a0c39ab06f61"][screenLang]}</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="space-y-4 pt-4">
          {(() => {
            const cats = liveLibraryCategories()
              .map((cat) => ({
                cat,
                items: liveVisibleItemsInCategory(cat.id, population),
              }))
              // A category with nothing in it for this person is a dead end —
              // either it was just created and has no lessons yet, or every
              // lesson in it is written for a different population.
              .filter((c) => c.items.length > 0);

            const current = cats.find((c) => c.cat.id === openCategory);

            if (current) {
              const prog = liveCategoryProgress(current.cat.id, completedItems, population);
              const CatIcon = resolveContentIcon(current.cat.icon);
              return (
                <div className="space-y-4">
                  <Button type="button" variant="ghost" onClick={() => setOpenCategory(null)}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> {SCREEN_COPY["ui.1e8c09c8a3d6"][screenLang]} </Button>
                  <Card className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                        <CatIcon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                          {categoryEyebrow(current.cat)}
                        </p>
                        <h2 className="font-semibold text-xl text-foreground">{current.cat.name}</h2>
                        <p className="text-sm text-foreground">{current.cat.desc}</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-foreground">
                        <span>
                          {prog.completed} {SCREEN_COPY["ui.de04fa0e29f9"][screenLang]} {prog.total} {SCREEN_COPY["ui.f957097d7a22"][screenLang]} </span>
                        <span>{prog.pct}%</span>
                      </div>
                      <Progress value={prog.pct} className="h-2" />
                    </div>
                    <ul className="space-y-2">
                      {current.items.map((item) => {
                        const done = completedItems.includes(item.id);
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => setOpenItem(item.id)}
                              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <div className="flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                  {item.title}
                                  {done && (
                                    <CheckCircle2 className="h-4 w-4 text-primary" aria-label={SCREEN_COPY["ui.1798b3ba42ee"][screenLang]} />
                                  )}
                                  {item.populations && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {SCREEN_COPY["ui.b48cc15f8db9"][screenLang]} </Badge>
                                  )}
                                </div>
                                <p className="text-sm italic text-foreground">“{item.problem}”</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" aria-hidden /> {item.minutes} {SCREEN_COPY["ui.b6c935d4f3c7"][screenLang]} </span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {activityKindLabel(item.activity.kind)}
                                  </Badge>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </div>
              );
            }

            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {cats.map(({ cat, items }) => {
                  const prog = liveCategoryProgress(cat.id, completedItems, population);
                  const CatIcon = resolveContentIcon(cat.icon);
                  return (
                    <Card key={cat.id} className="p-0">
                      <button
                        type="button"
                        onClick={() => setOpenCategory(cat.id)}
                        className="flex w-full flex-col gap-3 rounded-[inherit] p-5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                            <CatIcon className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="flex-1">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                              {categoryEyebrow(cat)}
                            </p>
                            <h2 className="font-semibold text-lg text-foreground">{cat.name}</h2>
                            <p className="text-sm text-foreground">{cat.desc}</p>
                          </div>
                        </div>
                        <div className="w-full">
                          <div className="mb-1.5 flex justify-between text-xs text-foreground">
                            <span>
                              {items.length} {SCREEN_COPY["ui.b11449a34df8"][screenLang]}{items.length === 1 ? "" : "s"} · {prog.completed} {SCREEN_COPY["ui.e5fd9cfe0e80"][screenLang]} </span>
                            <span>{prog.pct}%</span>
                          </div>
                          <Progress value={prog.pct} className="h-2" />
                        </div>
                      </button>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="exercises" className="grid gap-3 pt-4 sm:grid-cols-2">
          {exercises.map((ex) => {
            const done = completedExercises.includes(ex.id);
            return (
              <Card key={ex.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-lg text-foreground">{ex.title}</h3>
                  {done && <CheckCircle2 className="h-4 w-4 text-primary" aria-label={SCREEN_COPY["ui.1798b3ba42ee"][screenLang]} />}
                </div>
                <p className="flex-1 text-sm text-foreground">{ex.subtitle}</p>
                <div className="flex flex-wrap gap-1">
                  {ex.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpenExercise(ex.id)}>
                  {ex.minutes} {SCREEN_COPY["ui.7db2208cc987"][screenLang]} </Button>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="toolkit" className="space-y-3 pt-4">
          {toolkit.length === 0 ? (
            <Card className="p-6 text-sm text-foreground">
              {SCREEN_COPY["ui.66eead64fb66"][screenLang]} </Card>
          ) : (
            <ul className="space-y-2">
              {toolkit.map((t) => (
                <li key={t.id}>
                  <Card className="flex items-center gap-3 p-3">
                    <Wrench className="h-4 w-4 text-primary" aria-hidden />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{t.label}</div>
                      <div className="text-xs text-foreground">
                        {SCREEN_COPY["ui.3f66052a107e"][screenLang]} {t.from === "library" ? "a lesson" : "an exercise"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${t.label}`}
                      onClick={() => AdelanteEHR.removeToolkitItem(patientId, t.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </PatientPage>
  );
}
