// §Standalone route items — MY TOOLKIT.
//
// A read-only aggregation of what the patient already built: the Part B
// "Create my toolkit" picks from every completed Recovery lesson, plus the
// takeaways auto-saved by Library/Recovery/Exercise completions. Organised BY
// TOOL TYPE, not by lesson: the picks come from shared option vocabularies and
// a patient in a hard moment wants "my warning signs" as one list, not a hunt
// through nine modules. Lesson attribution is kept on every row, and every row
// links back to the lesson it came from.
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Backpack, HeartHandshake, Sparkles, TriangleAlert, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { liveRecoveryLesson, usePublishedContentVersion } from "@/lib/contentCatalog";
import { patientToolkit, type ToolkitPick } from "@/lib/toolkit";

function PickSection({
  icon: Icon,
  title,
  blurb,
  picks,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  picks: ToolkitPick[];
}) {
  if (picks.length === 0) return null;
  return (
    <Card className="space-y-3 p-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
      <ul className="space-y-2">
        {picks.map((p, i) => (
          <li
            key={`${p.lessonId}-${p.value}-${i}`}
            className="rounded-2xl border border-border bg-card p-3"
          >
            <p className="text-sm font-medium text-foreground">{p.value}</p>
            <Link
              to="/recovery-journey"
              search={{ lesson: p.lessonId }}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {p.moduleName ? `${p.moduleName} — ` : ""}
              {p.lessonTitle}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ToolkitPage() {
  usePublishedContentVersion();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const toolkit = useEhr(() => (patientId ? patientToolkit(patientId) : null));
  if (!patientId || !toolkit) return null;

  return (
    <PatientPage width="browse" data-testid="toolkit-page">
      <PatientPageHeader
        icon={Backpack}
        title="My toolkit"
        lede={
          <>
            Everything you built inside your lessons, kept in one place. Only you see this — it is
            not part of your clinical record.
          </>
        }
      />

      {toolkit.isEmpty ? (
        <Card className="space-y-3 p-6" data-testid="toolkit-empty">
          <h2 className="font-display text-lg text-foreground">Nothing built yet</h2>
          <p className="text-sm text-muted-foreground">
            Your toolkit fills itself in as you finish lessons. Each Recovery lesson ends with
            "Create my toolkit" — your warning signs, your people, and one action for today.
          </p>
          <Button asChild className="min-h-11 rounded-2xl">
            <Link to="/recovery-journey">Start a recovery lesson</Link>
          </Button>
        </Card>
      ) : (
        <>
          <PickSection
            icon={TriangleAlert}
            title="My warning signs"
            blurb="What you said tends to show up before things slide."
            picks={toolkit.warningSigns}
          />
          <PickSection
            icon={HeartHandshake}
            title="My people"
            blurb="Who you chose to reach for."
            picks={toolkit.supportPeople}
          />
          <PickSection
            icon={Footprints}
            title="One action for today"
            blurb="The single step you picked at the end of each lesson."
            picks={toolkit.todayActions}
          />
          {toolkit.takeaways.length > 0 && (
            <Card className="space-y-3 p-5">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  Saved takeaways
                </h2>
                <p className="text-sm text-muted-foreground">
                  One line saved from every lesson and exercise you finished.
                </p>
              </div>
              <ul className="space-y-2">
                {toolkit.takeaways.map((t) => {
                  const recovery = liveRecoveryLesson(t.id);
                  return (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3"
                    >
                      <span className="text-sm font-medium text-foreground">{t.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {recovery ? "Recovery" : t.from === "exercise" ? "Exercise" : "Library"}
                        </Badge>
                        {recovery ? (
                          <Link
                            to="/recovery-journey"
                            search={{ lesson: t.id }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            Open the lesson
                          </Link>
                        ) : (
                          <Link
                            to="/library"
                            search={t.from === "exercise" ? { exercise: t.id } : { item: t.id }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {t.from === "exercise" ? "Open the tool" : "Open the lesson"}
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      <Button asChild variant="ghost" className="min-h-11 rounded-2xl">
        <Link to="/recovery-journey">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back to my recovery journey
        </Link>
      </Button>
    </PatientPage>
  );
}
