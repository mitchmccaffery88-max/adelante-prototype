import { useEhr } from "@/lib/ehr";
import { todaysActivity } from "@/lib/structuredCarePlan";
// §E7 — Today's check-in folded into Adel's greeting on /home.
// Same patient-private mood store (`recordDailyCheckIn`); nothing reaches
// staff. Offered once per day: "Not now" hides it until tomorrow, no nagging.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Mic, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdelVoice } from "@/hooks/useAdelVoice";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  CHECK_IN_EMOTIONS,
  dailyCheckInDayKeys,
  recordDailyCheckIn,
  subscribeSelfTracking,
  todaysCheckIn,
  type EmotionId,
} from "@/lib/selfTracking";

const ES_LABEL: Record<EmotionId, string> = {
  anxious: "Ansioso/a",
  overwhelmed: "Abrumado/a",
  lonely: "Solo/a",
  hopeful: "Con esperanza",
  angry: "Enojado/a",
  depressed: "Deprimido/a",
  craving: "Con antojo",
  stressed: "Estresado/a",
  exhausted: "Agotado/a",
};

const COPY = {
  en: {
    hi: "Hi, I'm Adel.",
    ask: "How are you feeling today?",
    skip: "Not now",
    thanks: (f: string) => `Thanks for telling me — you're feeling ${f} today.`,
    skipped: "No problem. I'm here whenever you want to talk.",
    week: "My week",
    days: (n: number) => `You checked in ${n} of 7 days this week.`,
    change: "Change today's check-in",
    recap: "See my week",
    ask2: "Ask Adel",
    privacy: "Only you see this.",
  },
  es: {
    hi: "Hola, soy Adel.",
    ask: "¿Cómo se siente hoy?",
    skip: "Ahora no",
    thanks: (f: string) => `Gracias por contarme — hoy se siente ${f}.`,
    skipped: "Está bien. Aquí estoy cuando quiera hablar.",
    week: "Mi semana",
    days: (n: number) => `Hizo su registro ${n} de 7 días esta semana.`,
    change: "Cambiar el registro de hoy",
    recap: "Ver mi semana",
    ask2: "Preguntar a Adel",
    privacy: "Solo usted ve esto.",
  },
};

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const skipKey = (pid: string) => `adelante.adelCheckInSkipped.${pid}`;

export function AdelGreetingCheckIn({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const c = lang === "es" ? COPY.es : COPY.en;
  const key = useSyncExternalStore(
    subscribeSelfTracking,
    () => `${dailyCheckInDayKeys(patientId).join(",")}|${JSON.stringify(todaysCheckIn(patientId) ?? null)}`,
    () => "",
  );
  const today = useMemo(() => todaysCheckIn(patientId), [patientId, key]);
  const weekDays = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const from = dayKey(start);
    return new Set(dailyCheckInDayKeys(patientId).filter((d) => d >= from && d <= dayKey(now))).size;
  }, [patientId, key]);
  // Read storage after hydration only.
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    try {
      setSkipped(localStorage.getItem(skipKey(patientId)) === dayKey());
    } catch {
      /* private mode */
    }
  }, [patientId]);

  const todayAct = useEhr(() => todaysActivity(patientId));
  const label = (id: EmotionId) => {
    const e = CHECK_IN_EMOTIONS.find((x) => x.id === id)!;
    return lang === "es" ? ES_LABEL[id] : e.label;
  };
  const feelings = (today?.emotions ?? []).map((id) => label(id).toLowerCase()).join(", ");

  return (
    <Card className="p-5" data-testid="adel-greeting-checkin">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl">{c.hi}</p>
          {todayAct && (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="adel-today-activity">
              {lang === "es" ? `Para hoy en su plan: ${todayAct.label.es}.` : `On your plan today: ${todayAct.label.en}.`}
            </p>
          )}
          {!today && !skipped ? (
            <>
              <p className="mt-1 text-base" data-testid="adel-checkin-ask">{c.ask}</p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={c.ask}>
                {CHECK_IN_EMOTIONS.map((e) => (
                  <Button
                    key={e.id}
                    variant="outline"
                    className="min-h-11 rounded-2xl"
                    data-testid={`adel-mood-${e.id}`}
                    onClick={() => recordDailyCheckIn(patientId, { emotions: [e.id] })}
                  >
                    <span aria-hidden="true" className="mr-1">{e.emoji}</span>
                    {label(e.id)}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                className="mt-2 min-h-11"
                data-testid="adel-checkin-skip"
                onClick={() => {
                  try {
                    localStorage.setItem(skipKey(patientId), dayKey());
                  } catch {
                    /* ignore */
                  }
                  setSkipped(true);
                }}
              >
                {c.skip}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-base" data-testid="adel-checkin-ack">
                {today ? c.thanks(feelings) : c.skipped}
              </p>
              <div className="mt-3 rounded-2xl bg-secondary/60 p-3" data-testid="adel-my-week">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">{c.week}</p>
                <p className="mt-1 text-sm">{c.days(weekDays)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="min-h-11 rounded-2xl">
                    <Link to="/weekly-recap">{c.recap}</Link>
                  </Button>
                  {today && (
                    <Button asChild size="sm" variant="ghost" className="min-h-11">
                      <Link to="/checkin">{c.change}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
          <AskAdelBox lang={lang === "es" ? "es" : "en"} />
          <p className="mt-2 text-xs text-muted-foreground">{c.privacy}</p>
        </div>
      </div>
    </Card>
  );
}

const ASK_COPY = {
  en: {
    placeholder: "Ask Adel anything…",
    send: "Send to Adel",
    mic: "Speak to Adel",
    listening: "Listening…",
    useVoice: "Use my voice",
    heard: "Here's what I heard. Change it if needed, then send.",
    noMic: "Voice isn't available here. Please type instead.",
  },
  es: {
    placeholder: "Pregúntele a Adel lo que quiera…",
    send: "Enviar a Adel",
    mic: "Hablar con Adel",
    listening: "Escuchando…",
    useVoice: "Usar mi voz",
    heard: "Esto es lo que escuché. Cámbielo si hace falta y luego envíe.",
    noMic: "La voz no está disponible aquí. Escriba, por favor.",
  },
};

/**
 * Ask Adel from the tile. Sending opens the existing Adel chat with the
 * message already sent (same crisis scanner and guardrails). Voice is off
 * until the patient turns it on; heard text is shown for confirmation first.
 */
function AskAdelBox({ lang }: { lang: "en" | "es" }) {
  const c = ASK_COPY[lang];
  const navigate = useNavigate();
  const voice = useAdelVoice(lang);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState(false);
  const [micFailed, setMicFailed] = useState(false);
  const noMic = !voice.canListen || micFailed;
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    void navigate({ to: "/adel", search: { ask: t } });
  };
  return (
    <form
      className="mt-3 space-y-2"
      data-testid="adel-tile-ask"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label={c.placeholder}
          placeholder={c.placeholder}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-11 flex-1"
          data-testid="adel-tile-input"
        />
        {voice.enabled && !noMic ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={voice.listening ? c.listening : c.mic}
            data-testid="adel-tile-mic"
            onClick={() =>
              voice.listening
                ? voice.stopListening()
                : voice.listen(
                    (t) => {
                      setText(t);
                      setHeard(true);
                    },
                    () => setMicFailed(true),
                  )
            }
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={c.useVoice}
            title={c.useVoice}
            data-testid="adel-tile-mic"
            disabled={voice.enabled && noMic}
            onClick={() => voice.setEnabled(true)}
          >
            <Mic className="h-4 w-4 opacity-60" aria-hidden="true" />
          </Button>
        )}
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label={c.send} disabled={!text.trim()} data-testid="adel-tile-send">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {heard && <p className="text-xs text-muted-foreground">{c.heard}</p>}
      {voice.enabled && noMic && <p className="text-xs text-muted-foreground" data-testid="adel-tile-no-mic">{c.noMic}</p>}
    </form>
  );
}
