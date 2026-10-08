import { useState } from "react";
import { publishedContent, getContentEntry } from "@/lib/contentPublishing";
import { liveRecoveryLessons } from "@/lib/contentCatalog";
import { Button } from "@/components/ui/button";
import { ContentPreviewBoundary } from "@/lib/contentPreviewMode";
import { ContentPreviewLanguage, useI18n } from "@/lib/i18n";
import { LibraryLesson } from "@/components/library/LibraryLesson";
import { RecoveryLessonView } from "@/components/recovery/RecoveryLessonView";
import { ExerciseBody } from "@/components/library/ExercisePlayer";
import { asLibraryItem, asRecoveryLesson, contentType } from "@/lib/contentTypes";
import type { ContentBody, ContentTypeId } from "@/lib/contentPublishing";
import type { Exercise } from "@/lib/library";
import { LessonReadAloud } from "@/components/voice/LessonReadAloud";
function Player({ typeId, id, body }: { typeId: ContentTypeId; id: string; body: ContentBody }) {
  const { lang } = useI18n();
  const [step, setStep] = useState(0);
  if (typeId === "journey" || typeId === "recovery_module") {
    const steps = typeId === "journey" && Array.isArray(body.steps) ? body.steps as { type: ContentTypeId; id: string }[] : liveRecoveryLessons().filter((l) => l.moduleId === id).map((l) => ({ type: "recovery_lesson" as ContentTypeId, id: l.id }));
    const current = steps[step]; const selected = current ? publishedContent(current.type, current.id) ?? getContentEntry(current.type, current.id)?.body ?? (current.type === "recovery_lesson" ? liveRecoveryLessons().find((l) => l.id === current.id) as unknown as ContentBody : undefined) : undefined;
    return <div className="space-y-4"><h3 className="text-xl font-semibold">{contentType(typeId).titleOf(body)}</h3><div className="flex flex-wrap gap-2">{steps.map((s, i) => <Button key={i} variant={i === step ? "default" : "outline"} onClick={() => setStep(i)}>{i + 1}. {contentType(s.type).titleOf(publishedContent(s.type, s.id) ?? getContentEntry(s.type, s.id)?.body ?? { title: "Shipped content" })}</Button>)}</div>{current && selected && <Player key={current.id} typeId={current.type} id={current.id} body={selected} />}</div>;
  }
  const translated = lang === "es" && body.es && typeof body.es === "object" ? { ...body, ...body.es as ContentBody } : body;
  if (typeId === "library_lesson") return <LibraryLesson key={`${id}:${lang}`} item={asLibraryItem(translated, id)} patientId="" />;
  if (typeId === "recovery_lesson") return <RecoveryLessonView key={`${id}:${lang}`} lesson={asRecoveryLesson(translated, id)} patientId="" />;
  if (typeId === "exercise") return <ExerciseBody key={`${id}:${lang}`} exercise={{ ...translated, id } as unknown as Exercise} patientId="" />;
  const title = contentType(typeId).titleOf(translated);
  return <div className="patient-theme space-y-4 rounded-3xl bg-card p-6 text-card-foreground"><h2 className="text-2xl font-semibold">{title}</h2><LessonReadAloud text={`${title}. ${String(translated.description ?? translated.subtitle ?? "")}`} stepKey={id} /><p>{String(translated.description ?? translated.subtitle ?? "")}</p>{typeId === "community_resource" && <><p>{String(body.address ?? "")}</p><p>{String(body.phone ?? "")}</p></>}</div>;
}
export function RealContentPreview(props: { typeId: ContentTypeId; id: string; body: ContentBody }) {
  return <ContentPreviewBoundary><div data-testid="private-content-preview" className="patient-theme"><p role="status" className="mb-3 border-l-4 border-primary bg-muted px-4 py-2 font-medium">Preview — nothing is saved</p><ContentPreviewLanguage><Player {...props} /></ContentPreviewLanguage></div></ContentPreviewBoundary>;
}
