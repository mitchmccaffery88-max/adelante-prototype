import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { useAdelVoice } from "@/hooks/useAdelVoice";
import { startBreath, tickBreath } from "@/lib/breathing";

export function BreathingPractice({ inhaleSec, holdSec, exhaleSec, holdAfterSec = 0, cycles, completed = 0, onCycles }: { inhaleSec: number; holdSec: number; exhaleSec: number; holdAfterSec?: number; cycles: number; completed?: number; onCycles?: (n: number) => void }) {
  const { t, lang } = useI18n();
  const voice = useAdelVoice(lang);
  const [cues, setCues] = useState(false);
  const durations = [inhaleSec, holdSec, exhaleSec, holdAfterSec];
  const [state, setState] = useState(() => ({ ...startBreath(durations), cycles: completed, finished: completed >= cycles }));
  const [grown, setGrown] = useState(false);
  const [running, setRunning] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); setReduced(mq.matches); const changed = () => setReduced(mq.matches); mq.addEventListener("change", changed); return () => mq.removeEventListener("change", changed); }, []);
  useEffect(() => { if (!running) return; const id = requestAnimationFrame(() => setGrown(state.phase === 0 || state.phase === 1)); return () => cancelAnimationFrame(id); }, [running, state.phase]);
  useEffect(() => { if (!running || state.finished) return; const id = window.setInterval(() => setState((current) => tickBreath(current, durations, cycles)), 1000); return () => window.clearInterval(id); }, [running, state.finished, inhaleSec, holdSec, exhaleSec, holdAfterSec, cycles]);
  useEffect(() => { if (state.cycles !== completed) onCycles?.(state.cycles); if (state.finished) setRunning(false); }, [state.cycles, state.finished, completed, onCycles]);
  const phaseText = t(state.phase === 0 ? "playerInhale" : state.phase === 2 ? "playerExhale" : "playerHold");
  useEffect(() => { if (running && cues && !state.finished) voice.speak(phaseText, { force: true }); }, [running, cues, phaseText, state.finished, voice.speak]);
  return <div className="breathing-practice space-y-4 text-center" data-phase={state.phase}>
    <p>{t("playerCycle")} {Math.min(state.cycles + 1, cycles)} {t("playerOf")} {cycles}</p>
    {!reduced && <div className={`breath-shape phase-${state.phase} ${running ? "is-running" : "is-paused"}`} data-testid="breath-shape" aria-hidden style={{ "--breath-seconds": `${durations[state.phase]}s`, transform: `scale(${grown ? 1.35 : .75})` } as React.CSSProperties} />}
    <p className="text-2xl font-semibold">{state.finished ? t("playerDone") : phaseText}</p>
    <p className="text-5xl font-semibold tabular-nums text-primary" role="timer">{state.left}</p>
    <div className="flex justify-center gap-2"><Button className="min-h-11 rounded-full" disabled={state.finished} onClick={() => setRunning((v) => !v)}>{t(running ? "playerPause" : "playerStart")}</Button><Button className="min-h-11 rounded-full" variant="outline" onClick={() => { setRunning(false); setState(startBreath(durations)); }}>{t("playerReset")}</Button></div>
    <label className="flex min-h-11 items-center justify-center gap-2"><Checkbox checked={cues} onCheckedChange={(on) => { setCues(Boolean(on)); if (!on) voice.stop(); }} />{t("playerCues")}</label>
  </div>;
}