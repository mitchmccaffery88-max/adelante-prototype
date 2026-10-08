import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";
import type { LessonResponse, LessonResponsePatch } from "@/lib/engagement";
import type { LessonRecommend } from "@/lib/lessonRecommends";

export function AdelConversation({ patientId, topic, reflection, question, recommends, response, onChange }: { patientId: string; topic: string; reflection: string; question: string; recommends: LessonRecommend[]; response?: LessonResponse; onChange: (p: LessonResponsePatch) => void }) {
  const { t } = useI18n();
  const questions = [question, t("playerQuestion2"), t("playerQuestion3")];
  const index = Math.min(response?.adelIndex ?? 0, questions.length);
  const key = `adel:${index}`;
  return <div className="space-y-4" data-testid="adel-conversation">
    <p className="rounded-2xl bg-accent p-4">{reflection}</p><p>{t("playerSimulated")}</p>
    {index < questions.length ? <>
      <p>{t("playerQuestion")} {index + 1} {t("playerOf")} {questions.length}</p>
      {index > 0 && <p role="status">{t("playerReply")}</p>}
      <label htmlFor="adel-lesson-answer">{questions[index]}</label>
      <Textarea id="adel-lesson-answer" value={response?.text?.[key] ?? ""} onChange={(event) => { const text = event.target.value; onChange({ text: { [key]: text } }); scanTextForCrisis(patientId, text, { surface: "lesson_adel" }); }} />
      <Button className="rounded-full" disabled={!response?.text?.[key]?.trim()} onClick={() => { onChange({ adelIndex: index + 1 }); }}>{t("playerSend")}</Button>
    </> : <>
      <p role="status">{t("playerReply")}</p><h3 className="text-xl font-semibold">{t("playerSuggests")}</h3>
      {recommends.slice(0, 2).map((r) => <Button key={r.label} asChild variant="outline" className="mr-2 rounded-full"><Link to={r.to} search={r.search}>{r.label}</Link></Button>)}
      <Button asChild className="rounded-full"><Link to="/adel" search={{ topic }}>{t("playerKeepTalking")}</Link></Button>
    </>}
  </div>;
}