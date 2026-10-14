import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { todaysActivity } from "@/lib/structuredCarePlan";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageSquare, Mic, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdelVoice } from "@/hooks/useAdelVoice";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { monthlyCheckInCount } from "@/lib/checkInStreak";
import { dailyCheckInDayKeys, subscribeSelfTracking } from "@/lib/selfTracking";
import { CHECK_IN_COPY } from "@/lib/checkInCopy";
import { EmotionCheckIn } from "@/components/patient/EmotionCheckIn";

export function AdelGreetingCheckIn({ patientId }: { patientId: string }) {
  const { lang } = useI18n(); const c = CHECK_IN_COPY[lang];
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const doses = useEhr(() => AdelanteEHR.listDoseSelfReports(patientId));
  const quick = useEhr(() => AdelanteEHR.quickCheckDates(patientId));
  const key = useSyncExternalStore(subscribeSelfTracking, () => dailyCheckInDayKeys(patientId).join(","), () => "");
  const count = useMemo(() => monthlyCheckInCount({ doseSelfReportDates: doses.map(r => r.facilityDate), quickCheckCompletedAt: quick, dailyCheckInDayKeys: dailyCheckInDayKeys(patientId) }, new Date(), patient?.facilityTimezone), [patientId, key, doses, quick, patient?.facilityTimezone]);
  const activity = useEhr(() => todaysActivity(patientId));
  return <Card className="min-w-0 p-5" data-testid="adel-greeting-checkin">
    <div className="flex items-start gap-3"><MessageSquare className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1 space-y-3">
      <p className="font-display text-xl">{c.hi}</p>
      {activity && <p className="text-sm text-muted-foreground" data-testid="adel-today-activity">{c.plan}: {activity.label[lang]}.</p>}
      <EmotionCheckIn key={patientId} patientId={patientId} presentation="greeting" />
      {count > 0 && <p className="text-sm text-muted-foreground" data-testid="adel-my-week">{c.month(count)}</p>}
      <p>{c.help}</p><AskAdelBox lang={lang} />
    </div></div>
  </Card>;
}

/**
 * Ask Adel from the tile. Sending opens the existing Adel chat with the
 * message already sent (same crisis scanner and guardrails). Voice is off
 * until the patient turns it on; heard text is shown for confirmation first.
 */
function AskAdelBox({ lang }: { lang: "en" | "es" }) {
  const c = CHECK_IN_COPY[lang];
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
          className="min-h-12 flex-1"
          data-testid="adel-tile-input"
        />
        {voice.enabled && !noMic ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 shrink-0"
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
            className="h-12 w-12 shrink-0"
            aria-label={c.useVoice}
            title={c.useVoice}
            data-testid="adel-tile-mic"
            disabled={voice.enabled && noMic}
            onClick={() => voice.setEnabled(true)}
          >
            <Mic className="h-4 w-4 opacity-60" aria-hidden="true" />
          </Button>
        )}
        <Button type="submit" size="icon" className="h-12 w-12 shrink-0" aria-label={c.send} disabled={!text.trim()} data-testid="adel-tile-send">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {heard && <p className="text-sm text-muted-foreground">{c.heard}</p>}
      {voice.enabled && noMic && <p className="text-sm text-muted-foreground" data-testid="adel-tile-no-mic">{c.noMic}</p>}
    </form>
  );
}
