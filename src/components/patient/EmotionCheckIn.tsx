import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, CircleAlert, Volume2, VolumeX, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ExerciseTimer } from "@/components/library/ExercisePlayer";
import { useI18n } from "@/lib/i18n";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useAdelVoice } from "@/hooks/useAdelVoice";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";
import { CHECK_IN_EMOTIONS, CHECK_IN_REASONS, subscribeSelfTracking, todaysCheckIn, checkInPostponed, refreshCheckInPostponement, type EmotionId, type CheckInReasonId } from "@/lib/selfTracking";
import { applyPrivateUpdate } from "@/lib/privateSelfTrackingActions";
import { patientCheckInContext, type CheckInContextItem } from "@/lib/patientCheckInContext";
import { checkInSummaryPlan } from "@/lib/checkInSummary";
import { livePatientLibraryItems, liveExercise, usePublishedContentVersion } from "@/lib/contentCatalog";
import { usePopulation } from "@/components/PopulationGate";
import { isLibraryItemVisible } from "@/lib/library";
import { recoveryJourneyVisible } from "@/lib/seeking";
import { patientVisibleResources, subscribeResources } from "@/lib/communityResources";
import { PART2_CAUTION_CATEGORY_IDS } from "@/lib/sdohResourceMatch";
import { completePlayerExercise } from "@/lib/patientPlayerActions";

export type EmotionCheckInProps = { patientId: string; presentation: "greeting" | "card"; onComplete?: () => void };
function ContextChoice({ item }: { item: CheckInContextItem }) {
  const content = <><span className="min-w-0 flex-1 text-left"><span className="block">{item.label}</span>{item.detail && <span className="block text-sm text-muted-foreground">{item.detail}</span>}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></>;
  if (item.kind === "appointment" || item.kind === "group") return <Button asChild variant="outline" className="min-h-12 w-full justify-between"><Link to="/schedule" search={{ tab: item.kind === "group" ? "groups" : "yours" }}>{content}</Link></Button>;
  if (item.kind === "refill") return <Button asChild variant="outline" className="min-h-12 w-full justify-between"><Link to="/medications">{content}</Link></Button>;
  return <Button asChild variant="outline" className="min-h-12 w-full justify-between"><Link to="/next-steps">{content}</Link></Button>;
}
export function EmotionCheckIn({ patientId, presentation, onComplete }: EmotionCheckInProps) {
  const { lang } = useI18n(); const c = CHECK_IN_COPY[lang];
  const population = usePopulation(patientId);
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const context = useEhr(() => patientCheckInContext(patientId, new Date(), lang));
  const version = usePublishedContentVersion();
  const resourceKey = useSyncExternalStore(subscribeResources, () => JSON.stringify(patientVisibleResources().map(r => r.id)), () => "");
  const state = useSyncExternalStore(subscribeSelfTracking, () => JSON.stringify({ today: todaysCheckIn(patientId) ?? null, postponed: checkInPostponed(patientId) }), () => '{"today":null,"postponed":false}');
  const { today, postponed } = JSON.parse(state) as { today: ReturnType<typeof todaysCheckIn> | null; postponed: boolean };
  const [step, setStep] = useState<"emotions" | "why" | "summary">("emotions");
  const [selected, setSelected] = useState<EmotionId[]>([]); const [editing, setEditing] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false); const [error, setError] = useState(false);
  const voice = useAdelVoice(lang);
  useEffect(() => {
    const refresh = () => refreshCheckInPostponement(patientId);
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, [patientId]);
  const emotions = step === "summary" ? selected : today?.emotions ?? [];
  const plan = useMemo(() => checkInSummaryPlan(emotions, lang), [state, selected, step, lang]);
  const lesson = useMemo(() => {
    if (!plan) return undefined;
    const choices = livePatientLibraryItems().filter(i => i.categoryId === plan.libraryCategoryId && isLibraryItemVisible(i, population) && (!i.part2Sensitive || recoveryJourneyVisible(patient))).sort((a,b) => a.order - b.order);
    return plan.emotion === "okay" ? choices.find(i => i.id === "ss-stability-plan") ?? choices[0] : choices[0];
  }, [plan, population, patient, version]);
  const resource = useMemo(() => plan?.resourceCategoryId ? patientVisibleResources(plan.resourceCategoryId)[0] : undefined, [plan, resourceKey]);
  const exercise = liveExercise("urge-surfing-timer");
  const timer = exercise?.content.type === "timer" ? exercise.content : undefined;
  const feelings = (today?.emotions ?? []).map(id => c.emotions[id]).filter(Boolean).join(", ") || c.noFeelings;
  const speech = presentation === "greeting" && !today && !postponed ? `${c.ask} ${c.help}` : today ? `${c.thanks} ${plan?.reflection ?? ""} ${c.nextChoice}` : c.skipped;
  useEffect(() => { if (voice.enabled) voice.speak(speech); }, [speech, voice.enabled, voice.speak]);
  const save = (reasonId?: CheckInReasonId) => {
    try { applyPrivateUpdate(patientId, { kind: "save", emotions: selected, reasonId }); setEditing(false); setStep("summary"); setError(false); onComplete?.(); } catch { setError(true); }
  };
  const skip = () => { try { applyPrivateUpdate(patientId, { kind: "postpone" }); setSelected([]); setStep("emotions"); setEditing(false); } catch { setError(true); } };
  const formatAt = (at: string) => new Intl.DateTimeFormat(lang, { timeZone: patient?.facilityTimezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(at));
  const lessonTitle = lang === "es" && lesson && "title_es" in lesson && typeof lesson.title_es === "string" && lesson.title_es ? lesson.title_es : lesson?.title;
  const lessonChoice = lesson ? <Button asChild variant="outline" className="min-h-12 w-full justify-between" data-testid="check-in-library-rec"><Link to="/library" search={{ item: lesson.id }}><span className="min-w-0 text-left"><span className="block">{lessonTitle}</span><span className="block text-sm text-muted-foreground">{c.lesson} · {lesson.minutes} {c.minutes}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link></Button> : null;
  return <div className="member-comfortable min-w-0 space-y-3" data-testid="emotion-check-in">
    {presentation === "greeting" && context.happening.length > 0 && <div data-testid="check-in-happening"><p className="font-semibold">{context.period === "today" ? c.today : c.week}</p><ul className="mt-1 space-y-1 text-sm text-muted-foreground">{context.happening.map(i => <li key={`${i.kind}-${i.id}`}>{i.label}{i.detail ? ` · ${i.detail}` : ""}{i.at ? ` · ${formatAt(i.at)}` : ""}</li>)}</ul></div>}
    {error && <p className="flex items-center gap-2 text-sm text-attention"><CircleAlert className="size-4" aria-hidden="true" />{c.notNow}</p>}
    {postponed && step !== "summary" ? <p data-testid="adel-checkin-ack">{c.skipped}</p> : today && !editing && step !== "summary" ? <div className="space-y-3" data-testid="daily-check-in-done"><p>{c.checked} — {feelings}.</p><Button variant="outline" onClick={() => { setSelected(today.emotions); setEditing(true); setStep("emotions"); }}>{c.change}</Button></div> : step === "emotions" ? <>
      <p data-testid="adel-checkin-ask">{c.ask}</p><p className="text-sm text-muted-foreground">{c.pick}</p>
      <div role="group" aria-label={c.ask} className="flex flex-wrap gap-2">{CHECK_IN_EMOTIONS.map(e => { const on = selected.includes(e.id); return <Button key={e.id} variant="outline" type="button" aria-pressed={on} data-testid={`emotion-${e.id}`} onClick={() => setSelected(prev => on ? prev.filter(id => id !== e.id) : [...prev, e.id])} className={`min-h-12 h-auto max-w-full gap-2 rounded-md border-[1.5px] px-3 py-2 text-base ${on ? "border-2 border-path bg-path-soft text-foreground hover:bg-path-soft" : "border-line-strong bg-surface"}`}><img src={e.image} alt="" className="size-7 shrink-0" /><span className="min-w-0 whitespace-normal break-words">{c.emotions[e.id]}</span><span className="size-4 shrink-0">{on && <Check className="size-4" aria-hidden="true" />}</span></Button>; })}</div>
      <Button className="min-h-12 w-full" disabled={!selected.length} data-testid="daily-check-in-next" onClick={() => setStep("why")}>{c.next}</Button><Button variant="ghost" className="min-h-12" data-testid="adel-checkin-skip" onClick={skip}>{c.notNow}</Button>
    </> : step === "why" ? <>
      <p>{c.why}</p><div className="space-y-2">{CHECK_IN_REASONS.map(r => <Button key={r.id} variant="outline" className="min-h-12 w-full justify-start text-left" data-testid={`reason-${r.id}`} onClick={() => save(r.id)}>{c.reasons[r.id]}</Button>)}</div><Button variant="ghost" className="min-h-12 w-full" data-testid="daily-check-in-skip" onClick={() => save()}>{c.skipWhy}</Button><Button variant="ghost" onClick={skip}>{c.notNow}</Button>
    </> : <div className="space-y-3" data-testid="check-in-summary">
      <p>{c.thanks}</p>{plan && <p className="text-base" data-testid="check-in-reflection">{plan.reflection}</p>}<p className="font-semibold">{c.nextChoice}</p>
      <div className="space-y-2" data-testid="check-in-choices">
        {emotions.includes("craving") && timer && <Button variant="outline" className="min-h-12 w-full justify-between" data-testid="check-in-timer-choice" onClick={() => setTimerOpen(true)}><Waves className="size-5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 text-left">{c.timer}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Button>}
        {emotions.includes("craving") && lessonChoice}
        {context.items.map(i => <ContextChoice key={`${i.kind}-${i.id}`} item={{ ...i, detail: i.at ? formatAt(i.at) : i.detail }} />)}
        {!emotions.includes("craving") && lessonChoice}
        {resource && <Button asChild variant="outline" className="min-h-12 w-full justify-between" data-testid="check-in-resource-rec"><Link to="/resources"><span className="min-w-0 text-left"><span className="block">{PART2_CAUTION_CATEGORY_IDS.includes(resource.categoryId) ? c.resource : resource.name}</span><span className="block text-sm text-muted-foreground">{plan?.resourceReason}</span></span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link></Button>}
        <Button asChild variant="outline" className="min-h-12 w-full"><Link to="/adel">{c.askAdel}</Link></Button>
      </div><Button variant="ghost" data-testid="check-in-summary-done" onClick={() => { setStep("emotions"); setSelected([]); }}>{c.done}</Button>
    </div>}
    <p className="text-sm text-muted-foreground">{c.privacy}</p>
    <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" onClick={() => voice.speaking ? voice.stop() : (voice.setEnabled(true), voice.speak(speech, { force: true }))}>{voice.speaking ? <VolumeX className="size-5" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}{voice.speaking ? c.stop : c.read}</Button>{voice.enabled && <span className="text-sm text-muted-foreground">{c.simulated}</span>}</div>
    <Sheet open={timerOpen} onOpenChange={setTimerOpen}><SheetContent className="member-overlay w-full overflow-y-auto sm:max-w-lg"><SheetHeader><SheetTitle>{c.timer}</SheetTitle><SheetDescription>{c.timerHelp} {c.privacy}</SheetDescription></SheetHeader><div className="mt-6">{timer && <ExerciseTimer c={timer} onComplete={() => completePlayerExercise(patientId, "urge-surfing-timer")} />}</div></SheetContent></Sheet>
  </div>;
}