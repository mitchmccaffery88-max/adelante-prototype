// §Adelante Journey Phase 5 — the patient-facing Library surface.
//
// Population gating is Phase 2's: `usePopulation` resolves the viewer's track
// from the REAL record and `visibleItemsInCategory` drops any lesson whose
// copy is written for a population this person is not in. Most of the library
// carries no gate at all and is shown to everyone.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle2, Clock, Sunrise, Wrench, X } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { usePopulation } from "@/components/PopulationGate";
import {
  LIBRARY_CATEGORIES,
  getExercise,
  visibleExercises,
} from "@/lib/library";
// Lessons resolve through the CONTENT CATALOG, not the raw baseline module:
// a published admin edit or a newly published lesson must reach patients
// without a deployment. Exercises are not admin-managed yet, so they still
// come straight from the baseline.
import {
  liveCategoryProgress,
  liveLibraryItem,
  liveVisibleItemsInCategory,
  usePublishedContentVersion,
} from "@/lib/contentCatalog";
import { LibraryLesson } from "./LibraryLesson";
import { ExerciseBody } from "./ExercisePlayer";
import { toast } from "sonner";

export function LibraryBrowser({
  initialExercise,
  initialItem,
}: { initialExercise?: string; initialItem?: string } = {}) {
  usePublishedContentVersion();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const population = usePopulation(patientId);
  const completedItems = useEhr(() => AdelanteEHR.completedLibraryItems(patientId));
  const completedExercises = useEhr(() => AdelanteEHR.completedExercises(patientId));
  const toolkit = useEhr(() => AdelanteEHR.savedToolkitItems(patientId));
  const [openItem, setOpenItem] = useState<string | null>(initialItem ?? null);
  const [openExercise, setOpenExercise] = useState<string | null>(initialExercise ?? null);

  if (!patientId) return null;

  const lesson = openItem ? liveLibraryItem(openItem) : undefined;
  const exercise = openExercise ? getExercise(openExercise) : undefined;

  if (lesson) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Button type="button" variant="ghost" onClick={() => setOpenItem(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to the library
        </Button>
        <LibraryLesson item={lesson} patientId={patientId} onDone={() => setOpenItem(null)} />
      </div>
    );
  }

  if (exercise) {
    const done = completedExercises.includes(exercise.id);
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <Button type="button" variant="ghost" onClick={() => setOpenExercise(null)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to the library
        </Button>
        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl text-navy">{exercise.title}</h1>
              {done && (
                <Badge className="border-0 bg-teal/15 text-teal">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completed
                </Badge>
              )}
              {exercise.placeholder && (
                <Badge variant="outline" className="border-gold text-gold-foreground">
                  Placeholder content
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{exercise.subtitle}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> About {exercise.minutes} minutes
            </div>
          </div>
          <p className="rounded-lg bg-secondary/50 p-3 text-sm text-navy">{exercise.purpose}</p>
          <ExerciseBody exercise={exercise} />
          <Button
            type="button"
            onClick={() => {
              AdelanteEHR.completeExercise(patientId, exercise.id, { saveToolkit: true });
              toast.success(`Saved "${exercise.title}" to your toolkit.`);
              setOpenExercise(null);
            }}
          >
            Finish and save to my toolkit
          </Button>
        </Card>
      </div>
    );
  }

  const exercises = visibleExercises(population);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-navy">My library</h1>
        <p className="text-muted-foreground">
          Short lessons and practical tools you can use on your own, any time.
        </p>
      </header>

      <Tabs defaultValue="lessons">
        <TabsList>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="toolkit">My toolkit</TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="space-y-4 pt-4">
          {LIBRARY_CATEGORIES.map((cat) => {
            const items = liveVisibleItemsInCategory(cat.id, population);
            const prog = liveCategoryProgress(cat.id, completedItems, population);
            return (
              <Card key={cat.id} className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <Sunrise className="mt-0.5 h-5 w-5 text-teal" aria-hidden />
                  <div className="flex-1">
                    <h2 className="font-display text-xl text-navy">{cat.name}</h2>
                    <p className="text-sm text-muted-foreground">{cat.desc}</p>
                  </div>
                </div>
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
                  {items.map((item) => {
                    const done = completedItems.includes(item.id);
                    return (
                      <li key={item.id} className="flex items-center gap-3 py-2.5">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy">
                            {item.title}
                            {done && <CheckCircle2 className="h-4 w-4 text-teal" aria-label="Completed" />}
                            {item.populations && (
                              <Badge variant="outline" className="text-[10px]">
                                Reentry-specific
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.minutes} min</div>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => setOpenItem(item.id)}>
                          {done ? "Revisit" : "Start"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="exercises" className="grid gap-3 pt-4 sm:grid-cols-2">
          {exercises.map((ex) => {
            const done = completedExercises.includes(ex.id);
            return (
              <Card key={ex.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg text-navy">{ex.title}</h3>
                  {done && <CheckCircle2 className="h-4 w-4 text-teal" aria-label="Completed" />}
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{ex.subtitle}</p>
                <div className="flex flex-wrap gap-1">
                  {ex.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpenExercise(ex.id)}>
                  {ex.minutes} min · Open
                </Button>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="toolkit" className="space-y-3 pt-4">
          {toolkit.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Nothing saved yet. Finishing a lesson or an exercise puts its takeaway here.
            </Card>
          ) : (
            <ul className="space-y-2">
              {toolkit.map((t) => (
                <li key={t.id}>
                  <Card className="flex items-center gap-3 p-3">
                    <Wrench className="h-4 w-4 text-teal" aria-hidden />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-navy">{t.label}</div>
                      <div className="text-xs text-muted-foreground">
                        From {t.from === "library" ? "a lesson" : "an exercise"}
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
    </div>
  );
}
