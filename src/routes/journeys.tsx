import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { liveCurricula } from "@/lib/curriculumTypes";
import { curriculumProgress, curriculumVisible } from "@/lib/curriculumProgress";
import { liveLibraryItem, liveRecoveryLesson, liveExercise, liveRecoveryModules, liveRecoveryLessons } from "@/lib/contentCatalog";
import { publishedContent } from "@/lib/contentPublishing";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, ArrowRight } from "lucide-react";
export const Route = createFileRoute("/journeys")({
  validateSearch: (search: Record<string, unknown>) => ({ journey: typeof search.journey === "string" ? search.journey : undefined }),
  head: () => ({ meta: [{ title: "My Journeys — Adelante" }, { name: "description", content: "Your assigned lessons and practice, one step at a time." }, { property: "og:title", content: "My Journeys — Adelante" }, { property: "og:description", content: "Resume your personal learning Journey." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: JourneysPage,
});
function JourneysPage() {
  const { t, lang } = useI18n(); const { journey } = Route.useSearch(); const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const rows = useEhr(() => liveCurricula().filter((j) => curriculumVisible(patientId, j) && (!journey || j.id === journey)).map((j) => ({ j, progress: curriculumProgress(patientId, j) })));
  return <main className="patient-theme mx-auto max-w-3xl space-y-6 px-4 py-6"><h1 className="text-3xl font-semibold">{t("journeyHeading")}</h1>{rows.map(({ j, progress }) => <section key={j.id} className="space-y-5 rounded-3xl bg-card p-6 text-card-foreground"><h2 className="text-2xl font-semibold">{lang === "es" ? j.es?.title ?? t("playerSpanishSoon") : j.title}</h2><p>{lang === "es" ? j.es?.description ?? t("playerSpanishSoon") : j.description}</p>{lang === "es" && <p>{t("playerDraft")}</p>}<ol className="divide-y divide-border">{progress.steps.map((s, i) => { const item = s.type === "library_lesson" ? liveLibraryItem(s.id) : s.type === "exercise" ? liveExercise(s.id) : s.type === "recovery_lesson" ? liveRecoveryLesson(s.id) : liveRecoveryModules().find((m) => m.id === s.id); const es = publishedContent(s.type, s.id)?.es as { title?: string; name?: string } | undefined; const title = item && (lang === "es" ? es?.title ?? es?.name ?? t("playerSpanishSoon") : ("title" in item ? item.title : item.name)); return <li key={i} className="flex items-center justify-between gap-3 py-4"><span className="flex items-center gap-3">{s.done ? <CheckCircle2 className="size-5" /> : s.locked ? <Lock className="size-5" /> : <span>{i + 1}</span>}{title || t("journeyUnavailable")}</span>{s.locked ? <span>{t("journeyLocked")}</span> : <Button asChild variant={s.done ? "outline" : "default"} className="rounded-full"><Link to={s.type === "library_lesson" || s.type === "exercise" ? "/library" : "/recovery-journey"} search={s.type === "library_lesson" ? { item: s.id } : s.type === "exercise" ? { exercise: s.id } : s.type === "recovery_module" ? { lesson: liveRecoveryLessons().find((l) => l.moduleId === s.id && !AdelanteEHR.completedRecoveryLessons(patientId).includes(l.id))?.id ?? liveRecoveryLessons().find((l) => l.moduleId === s.id)?.id } : { lesson: s.id }}>{s.done ? t("modCompleted") : t("playerContinue")}<ArrowRight className="ml-2 size-4" /></Link></Button>}</li>; })}</ol></section>)}</main>;
}
