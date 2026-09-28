// §E5 Phase A — reusable voice UI: opt-in card, controls + transcript, voice answer.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mic, Pause, Play, RotateCcw, Volume2, VolumeX, LifeBuoy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdelVoice } from "@/hooks/useAdelVoice";
import type { VoiceLang } from "@/lib/adelVoice";
import { INTAKE_VOICE_COPY, VOICE_DRAFT_LABEL } from "@/lib/intakeVoiceCopy";

type Voice = ReturnType<typeof useAdelVoice>;

export function VoiceOptIn({ voice, lang }: { voice: Voice; lang: VoiceLang }) {
  const c = INTAKE_VOICE_COPY[lang];
  return (
    <div className="rounded-xl border-2 border-teal/40 bg-teal/5 p-4 space-y-2" data-testid="voice-optin">
      <div className="flex items-center gap-2 font-semibold text-navy"><Volume2 className="h-5 w-5 text-teal" aria-hidden="true" />{c.optInTitle}</div>
      <p className="text-sm text-foreground">{c.optInBody}</p>
      <p className="text-sm text-muted-foreground flex items-start gap-2"><Lock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />{c.privateSpot}</p>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" variant={voice.enabled ? "default" : "outline"} onClick={() => voice.setEnabled(true)} aria-pressed={voice.enabled}>{c.yes}</Button>
        <Button className="min-h-11" variant={!voice.enabled ? "secondary" : "outline"} onClick={() => voice.setEnabled(false)} aria-pressed={!voice.enabled}>{c.no}</Button>
      </div>
    </div>
  );
}

/** Controls + visible transcript. Auto-reads `text` when it changes and voice is on. */
export function VoiceBar({ voice, lang, text, tapOnly, draft = true }: { voice: Voice; lang: VoiceLang; text: string; tapOnly?: boolean; draft?: boolean }) {
  const c = INTAKE_VOICE_COPY[lang];
  const { enabled, speak } = voice;
  useEffect(() => { if (enabled && text) speak(text); }, [enabled, text, speak]);
  if (!enabled) {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => voice.setEnabled(true)} data-testid="voice-toggle-on"><VolumeX className="h-4 w-4 mr-1" aria-hidden="true" />{c.off}</Button>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-teal/40 bg-card p-3 space-y-2" data-testid="voice-bar" aria-label="Read aloud">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => speak(text, { force: true })} aria-label={c.play}><Play className="h-4 w-4" aria-hidden="true" /><span className="ml-1 hidden sm:inline">{c.play}</span></Button>
        <Button size="sm" variant="outline" onClick={voice.replay} aria-label={c.replay}><RotateCcw className="h-4 w-4" aria-hidden="true" /><span className="ml-1 hidden sm:inline">{c.replay}</span></Button>
        <Button size="sm" variant="outline" onClick={voice.stop} aria-label={c.stop}><Pause className="h-4 w-4" aria-hidden="true" /><span className="ml-1 hidden sm:inline">{c.stop}</span></Button>
        <div className="flex rounded-md border" role="group" aria-label="Speed">
          {(["slow", "normal"] as const).map((r) => (
            <button key={r} type="button" onClick={() => voice.setRate(r)} aria-pressed={voice.rate === r}
              className={`px-2 py-1 text-xs ${voice.rate === r ? "bg-teal text-primary-foreground" : ""}`}>{r === "slow" ? c.slow : c.normal}</button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => voice.setEnabled(false)} data-testid="voice-toggle-off"><Volume2 className="h-4 w-4 mr-1" aria-hidden="true" />{c.on}</Button>
        <Button size="sm" variant="destructive" asChild className="ml-auto"><Link to="/crisis"><LifeBuoy className="h-4 w-4 mr-1" aria-hidden="true" />{c.helpNow}</Link></Button>
      </div>
      <div className="text-sm">
        <div className="text-xs font-medium text-muted-foreground">{c.transcript}{voice.speaking ? " 🔊" : ""}</div>
        <p className="whitespace-pre-line text-foreground" data-testid="voice-transcript">{voice.transcript || text}</p>
        {draft && <p className="text-[11px] text-muted-foreground mt-1">{VOICE_DRAFT_LABEL}</p>}
      </div>
      {tapOnly && (
        <p className="rounded-md bg-muted p-2 text-xs text-navy flex items-start gap-2" data-testid="voice-tap-only">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{c.tapOnly} {c.privately}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Answer by voice with typed fallback. The heard text is shown and editable;
 * nothing is saved until the patient confirms. Audio is never stored.
 */
export function VoiceAnswer({ voice, lang, label, hint, value, onConfirm }: {
  voice: Voice; lang: VoiceLang; label: string; hint?: string; value: string; onConfirm: (text: string) => void;
}) {
  const c = INTAKE_VOICE_COPY[lang];
  const [draft, setDraft] = useState(value);
  const [heard, setHeard] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const noMic = !voice.canListen || micFailed;
  return (
    <div className="space-y-2" data-testid="voice-answer">
      <label className="text-sm font-medium text-navy" htmlFor="voice-answer-text">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {voice.enabled && !noMic && (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => voice.listen((t) => { setDraft(t); setHeard(true); setSaved(false); }, () => setMicFailed(true))} data-testid="voice-mic">
          <Mic className="h-4 w-4 mr-1" aria-hidden="true" />{voice.listening ? c.listening : c.answerByVoice}
        </Button>
      )}
      {voice.enabled && noMic && <p className="text-xs text-muted-foreground" data-testid="voice-no-mic">{c.noMic}</p>}
      {heard && <p className="text-xs text-muted-foreground">{c.heard} {c.edit}</p>}
      <Textarea id="voice-answer-text" aria-label={c.typeHere} placeholder={c.typeHere} maxLength={500} value={draft} onChange={(e) => { setDraft(e.target.value); setSaved(false); }} />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={!draft.trim()} onClick={() => { onConfirm(draft.trim()); setSaved(true); }} data-testid="voice-confirm">{c.confirm}</Button>
        {saved && <span className="text-xs text-teal" role="status">{c.saved}</span>}
      </div>
    </div>
  );
}
