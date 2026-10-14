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
import { recoveryJourneyVisible } from "@/lib/seeking";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.a0c39ab06f61": {
    "en": "My toolkit",
    "es": "Mi caja de herramientas"
  },
  "ui.1234509cea72": {
    "en": "Nothing built yet",
    "es": "Nada creado aún"
  },
  "ui.6f1485495e5b": {
    "en": "Your toolkit fills itself in as you finish lessons. Each Recovery lesson ends with \"Create my toolkit\" — your warning signs, your people, and one action for today.",
    "es": "Tu caja de herramientas se completa a medida que terminas las lecciones."
  },
  "ui.0c8f336d70b4": {
    "en": "Start a recovery lesson",
    "es": "Empezar una lección"
  },
  "ui.c6cfcdb17347": {
    "en": "Browse the library",
    "es": "Explorar la biblioteca"
  },
  "ui.39098690aa94": {
    "en": "My warning signs",
    "es": "Mis señales de alerta"
  },
  "ui.a24c531e3125": {
    "en": "My people",
    "es": "Mis personas"
  },
  "ui.d325ad256793": {
    "en": "One action for today",
    "es": "Una acción para hoy"
  },
  "ui.50583f4f00cc": {
    "en": "Saved takeaways",
    "es": "Conclusiones guardadas"
  },
  "ui.fa7ce65f4b61": {
    "en": "One line saved from every lesson and exercise you finished.",
    "es": "Una línea guardada de cada lección y ejercicio que terminaste."
  },
  "ui.28316c1f3568": {
    "en": "Open the lesson",
    "es": "Abrir la lección"
  },
  "ui.c0ae8f6ea841": {
    "en": "Saved",
    "es": "Guardado"
  },
  "ui.81da4bbb18fa": {
    "en": "Back to my recovery journey",
    "es": "Volver a mi camino"
  }
} as const;


function PickSection({
  icon: Icon,
  title,
  blurb,
  picks,
  showRecovery,
}: {
  icon: LucideIcon;
  title: string;
  blurb: string;
  picks: ToolkitPick[];
  showRecovery: boolean;
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
            {showRecovery ? (
              <Link
                to="/recovery-journey"
                search={{ lesson: p.lessonId }}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                {p.moduleName ? `${p.moduleName} — ` : ""}
                {p.lessonTitle}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">{p.lessonTitle}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ToolkitPage() {
  const { lang: screenLang } = useI18n();

  usePublishedContentVersion();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const toolkit = useEhr(() => (patientId ? patientToolkit(patientId) : null));
  const showRecovery = useEhr(() => recoveryJourneyVisible(AdelanteEHR.getPatient(patientId)));
  if (!patientId || !toolkit) return null;

  return (
    <PatientPage width="browse" data-testid="toolkit-page">
      <PatientPageHeader
        icon={Backpack}
        title={SCREEN_COPY["ui.a0c39ab06f61"][screenLang]}
        lede={
          <>
            Everything you built inside your lessons, kept in one place. Only you see this — it is
            not part of your clinical record.
          </>
        }
      />

      {toolkit.isEmpty ? (
        <Card className="space-y-3 p-6" data-testid="toolkit-empty">
          <h2 className="font-display text-lg text-foreground">{SCREEN_COPY["ui.1234509cea72"][screenLang]}</h2>
          <p className="text-sm text-muted-foreground">
            {SCREEN_COPY["ui.6f1485495e5b"][screenLang]} </p>
          <Button asChild className="min-h-11 rounded-2xl">
            {showRecovery ? <Link to="/recovery-journey">{SCREEN_COPY["ui.0c8f336d70b4"][screenLang]}</Link> : <Link to="/library">{SCREEN_COPY["ui.c6cfcdb17347"][screenLang]}</Link>}
          </Button>
        </Card>
      ) : (
        <>
          <PickSection
            icon={TriangleAlert}
            title={SCREEN_COPY["ui.39098690aa94"][screenLang]}
            blurb="What you said tends to show up before things slide."
            picks={toolkit.warningSigns}
            showRecovery={showRecovery}
          />
          <PickSection
            icon={HeartHandshake}
            title={SCREEN_COPY["ui.a24c531e3125"][screenLang]}
            blurb="Who you chose to reach for."
            picks={toolkit.supportPeople}
            showRecovery={showRecovery}
          />
          <PickSection
            icon={Footprints}
            title={SCREEN_COPY["ui.d325ad256793"][screenLang]}
            blurb="The single step you picked at the end of each lesson."
            picks={toolkit.todayActions}
            showRecovery={showRecovery}
          />
          {toolkit.takeaways.length > 0 && (
            <Card className="space-y-3 p-5">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  {SCREEN_COPY["ui.50583f4f00cc"][screenLang]} </h2>
                <p className="text-sm text-muted-foreground">
                  {SCREEN_COPY["ui.fa7ce65f4b61"][screenLang]} </p>
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
                        {recovery && showRecovery ? (
                          <Link
                            to="/recovery-journey"
                            search={{ lesson: t.id }}
                            className="text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {SCREEN_COPY["ui.28316c1f3568"][screenLang]} </Link>
                        ) : recovery ? (
                          <span className="text-xs text-muted-foreground">{SCREEN_COPY["ui.c0ae8f6ea841"][screenLang]}</span>
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

      {showRecovery && (
        <Button asChild variant="ghost" className="min-h-11 rounded-2xl">
          <Link to="/recovery-journey">
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.81da4bbb18fa"][screenLang]} </Link>
        </Button>
      )}
    </PatientPage>
  );
}
