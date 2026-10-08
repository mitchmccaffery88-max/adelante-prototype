import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { LibraryActivity } from "@/lib/library";
import type { LessonResponse, LessonResponsePatch } from "@/lib/engagement";

export function GroundingPractice({ activity, response, onChange }: { activity: Extract<LibraryActivity, { kind: "grounding" }>; response?: LessonResponse; onChange: (patch: LessonResponsePatch) => void }) {
  const { t } = useI18n();
  const index = Math.max(0, Math.min(response?.scores?.groundingIndex ?? 0, activity.senses.length - 1));
  const sense = activity.senses[index];
  if (!sense) return null;
  const words = [t("playerSee"), t("playerFeel"), t("playerHear"), t("playerSmell"), t("playerTaste")];
  const key = `grounding:${sense.label}`;
  return <div className="grounding-panel space-y-4 rounded-3xl p-6">
    <p className="text-center text-7xl font-semibold text-primary" aria-hidden>{sense.count}</p>
    <label htmlFor="grounding-answer" className="block text-center text-xl font-semibold">{sense.count} · {t("playerThings")} {words[index] ?? sense.label}</label>
    <Textarea id="grounding-answer" rows={3} value={response?.text?.[key] ?? ""} onChange={(event) => onChange({ text: { [key]: event.target.value } })} />
    <p className="text-center">{index + 1} {t("playerOf")} {activity.senses.length}</p>
    <div className="flex justify-between gap-2"><Button variant="outline" className="rounded-full" disabled={index === 0} onClick={() => onChange({ scores: { ...(response?.scores ?? {}), groundingIndex: index - 1 } })}>{t("playerBack")}</Button><Button className="rounded-full" disabled={index === activity.senses.length - 1} onClick={() => onChange({ scores: { ...(response?.scores ?? {}), groundingIndex: index + 1 } })}>{t("playerNext")}</Button></div>
  </div>;
}