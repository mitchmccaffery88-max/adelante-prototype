import { useEffect } from "react";
import { Volume2, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdelVoice } from "@/hooks/useAdelVoice";
import { isTapOnlyStep } from "@/lib/adelVoice";
import { useI18n } from "@/lib/i18n";

/** All spoken text is the currently displayed text. Sensitive steps never auto-read. */
export function LessonReadAloud({ text, stepKey, sensitive = false }: { text: string; stepKey: string; sensitive?: boolean }) {
  const { lang, t } = useI18n();
  const voice = useAdelVoice(lang);
  const tapOnly = isTapOnlyStep(stepKey, { isSud: sensitive });
  useEffect(() => {
    if (voice.enabled && !tapOnly && text.trim()) voice.speak(text);
    return voice.stop;
  }, [text, tapOnly, voice.enabled, voice.speak, voice.stop]);
  return <div className="lesson-voice space-y-2" aria-label={t("playerVoice")}>
    <p className="text-sm text-foreground">{t("playerVoice")}{lang === "es" ? ` · ${t("playerDraft")}` : ""}</p>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" className="min-h-11 rounded-full" onClick={() => { voice.setEnabled(true); voice.speak(text, { force: true }); }} aria-label={t("playerListen")}><Volume2 className="mr-2 size-4" />{t("playerListen")}</Button>
      <Button variant="ghost" className="min-h-11" onClick={voice.replay} aria-label={t("playerReplay")}><RotateCcw className="size-4" /></Button>
      <Button variant="ghost" className="min-h-11" onClick={() => { voice.stop(); voice.setEnabled(false); }} aria-label={t("playerStop")}><Square className="size-4" /></Button>
      <div role="group" aria-label={t("playerVoice")} className="flex gap-1">
        {(["slow", "normal"] as const).map((rate) => <Button key={rate} variant={voice.rate === rate ? "secondary" : "ghost"} className="min-h-11" aria-pressed={voice.rate === rate} onClick={() => voice.setRate(rate)}>{t(rate === "slow" ? "playerSlow" : "playerNormal")}</Button>)}
      </div>
    </div>
    {tapOnly && <p className="text-sm text-foreground">{t("playerTapOnly")}</p>}
    {voice.speaking && <p role="status" className="rounded-xl bg-accent p-3 text-accent-foreground"><mark className="bg-accent text-accent-foreground">{voice.activeSentence || voice.transcript}</mark></p>}
  </div>;
}