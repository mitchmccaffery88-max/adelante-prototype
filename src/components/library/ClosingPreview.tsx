import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { LessonResponse, LessonResponsePatch } from "@/lib/engagement";

export function ClosingPreview({ tool, response, supports = [], onChange }: { tool: string; response?: LessonResponse; supports?: string[]; onChange: (p: LessonResponsePatch) => void }) {
  const { t } = useI18n();
  return <div className="space-y-4" data-testid="toolkit-preview">
    <label htmlFor="player-support">{t("playerSupportPrompt")}</label><Input id="player-support" value={response?.text?.support ?? ""} onChange={(e) => onChange({ text: { support: e.target.value } })} />
    <p>{t("playerReminderPrompt")}</p><div className="flex flex-wrap gap-2">{(["playerTodayReminder", "playerTomorrowReminder", "playerNoReminder"] as const).map((key) => <Button key={key} variant={response?.text?.reminder === key ? "default" : "outline"} className="rounded-full" aria-pressed={response?.text?.reminder === key} onClick={() => onChange({ text: { reminder: key } })}>{t(key)}</Button>)}</div>
    <h3 className="text-xl font-semibold">{t("playerPreview")}</h3><dl className="space-y-3 rounded-2xl bg-accent p-5">
      <div><dt>{t("playerTool")}</dt><dd>{tool}</dd></div>
      <div><dt>{t("playerNextStep")}</dt><dd>{response?.todayAction || t("playerNone")}</dd></div>
      <div><dt>{t("playerReminder")}</dt><dd>{response?.text?.reminder ? t(response.text.reminder as "playerTodayReminder") : t("playerNone")}</dd></div>
      <div><dt>{t("playerSupports")}</dt><dd>{[...supports, response?.text?.support].filter(Boolean).join(" · ") || t("playerNone")}</dd></div>
    </dl>
  </div>;
}