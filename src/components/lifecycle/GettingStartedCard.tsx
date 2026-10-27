import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { patientGettingStarted, showGettingStarted } from "@/lib/gettingStarted";

const COPY = {
  en: { title: "Getting started", still: "Still need help with this?", yes: "Yes, I still need help", no: "Not anymore", saved: "Thanks — your team will see this." },
  es: { title: "Para empezar", still: "¿Todavía necesitas ayuda con esto?", yes: "Sí, todavía necesito ayuda", no: "Ya no", saved: "Gracias — tu equipo lo va a ver." },
} as const;

/** Patient Home: first steps after enrolling, from the person's own records. */
export function GettingStartedCard({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const L = lang === "es" ? "es" : "en";
  const c = COPY[L];
  const show = useEhr(() => showGettingStarted(AdelanteEHR.getPatient(patientId)));
  const json = useEhr(() => JSON.stringify(patientGettingStarted(patientId, L)));
  if (!show) return null;
  const items = JSON.parse(json) as ReturnType<typeof patientGettingStarted>;
  const answer = (needId: string, still: boolean) => {
    const actor = { role: PATIENT_ACTOR_ROLE, staffId: patientId };
    const r = runAction("patient_need_confirm", actor, AdelanteEHR.getPatient(patientId), { args: [actor, patientId, needId, still] });
    if (!r.ok) toast.error(r.reason); else toast.success(c.saved);
  };
  return (
    <Card className="min-w-0 p-5 space-y-3" data-testid="getting-started">
      <h2 className="text-xl font-bold">{c.title}</h2>
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.id} className="flex min-w-0 items-start gap-3">
            {i.done ? <CheckCircle2 className="mt-1 size-5 shrink-0 text-path" aria-hidden="true" /> : <Circle className="mt-1 size-5 shrink-0 text-ink-muted" aria-hidden="true" />}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium">{i.label}</p>
              {i.detail && <p className="text-ink-muted">{i.detail}</p>}
              {i.needId && !i.detail && (
                <div className="space-y-2">
                  <p>{c.still}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => answer(i.needId!, true)}>{c.yes}</Button>
                    <Button variant="ghost" onClick={() => answer(i.needId!, false)}>{c.no}</Button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
