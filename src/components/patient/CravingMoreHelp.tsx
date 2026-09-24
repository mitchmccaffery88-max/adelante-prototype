// §Pre-demo E2 — more options on "Craving right now".
//
// - Tell my care team → the EXISTING patient care-message path
//   (`AdelanteEHR.sendPatientMessage`, audited `care_message_sent`), shown in
//   the staff message queue. Deliberately NOT a crisis flag: craving
//   escalation policy is still a held decision, and 988 stays one tap away.
// - Open my safety plan → the existing /safety-plan.
// - Naloxone / overdose help → the community directory has NO naloxone
//   category or entry today, so we show the category with a clearly labelled
//   "Demo content" note and link the existing /naloxone safety page. No
//   invented names, addresses or phone numbers.
// - Need a ride? → real `transportation` entries from the directory.
//
// OPEN — Spanish strings pending bilingual review.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing, Bus, ClipboardList, MessageSquare, Phone, ShieldPlus, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { patientBrowsableResources } from "@/lib/communityResources";
import { CRISIS_LIFELINE_NUMBER } from "@/lib/safetyPlan";
import { useI18n } from "@/lib/i18n";

const COPY = {
  en: {
    heading: "More help right now",
    call: "Call 988",
    call911: "Emergency? Call 911",
    text: "Text 988",
    tell: "Tell my care team",
    tellSent: "Your care team got your message. If you can't wait, call or text 988.",
    tellBody: "I'm having a craving right now and could use some support.",
    plan: "Open my safety plan",
    naloxone: "Naloxone / overdose help in Tulare",
    naloxoneDemo:
      "Demo content — to be confirmed. Our resource directory doesn't list naloxone locations in Tulare County yet. Your care team can get you naloxone. The overdose safety page has the steps and statewide options.",
    naloxoneOpen: "Open overdose safety",
    ride: "Need a ride?",
    rideEmpty: "Demo content — to be confirmed. No transportation listings yet. Ask your care team.",
  },
  es: {
    heading: "Más ayuda ahora mismo",
    call: "Llamar al 988",
    call911: "¿Emergencia? Llama al 911",
    text: "Texto al 988",
    tell: "Avisar a mi equipo de cuidado",
    tellSent: "Tu equipo recibió tu mensaje. Si no puedes esperar, llama o envía un texto al 988.",
    tellBody: "Tengo un antojo ahora mismo y me vendría bien un poco de apoyo.",
    plan: "Abrir mi plan de seguridad",
    naloxone: "Naloxona / ayuda por sobredosis en Tulare",
    naloxoneDemo:
      "Contenido de demostración — por confirmar. Nuestro directorio todavía no tiene lugares con naloxona en el condado de Tulare. Tu equipo de cuidado te la puede conseguir. La página de seguridad tiene los pasos y opciones estatales.",
    naloxoneOpen: "Abrir seguridad por sobredosis",
    ride: "¿Necesitas transporte?",
    rideEmpty: "Contenido de demostración — por confirmar. Todavía no hay opciones de transporte. Pregunta a tu equipo.",
  },
} as const;

export function CravingMoreHelp() {
  const { lang } = useI18n();
  const c = COPY[lang === "es" ? "es" : "en"];
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const [open, setOpen] = useState<"naloxone" | "ride" | null>(null);
  const [sent, setSent] = useState(false);
  const rides = patientBrowsableResources("transportation");

  const tell = () => {
    const msg = patientId ? AdelanteEHR.sendPatientMessage(patientId, c.tellBody) : undefined;
    if (msg) {
      setSent(true);
      toast.success(c.tellSent);
    } else toast.error("Could not send that.");
  };

  const row = "min-h-12 w-full justify-start rounded-2xl text-base";
  return (
    <Card className="space-y-3 p-5" data-testid="craving-more-help">
      <p className="text-sm font-medium text-muted-foreground">{c.heading}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="crisis" className="min-h-12 rounded-2xl">
          <a href={`tel:${CRISIS_LIFELINE_NUMBER}`} data-testid="craving-call-988">
            <Phone className="mr-1.5 h-4 w-4" aria-hidden="true" /> {c.call}
          </a>
        </Button>
        <Button asChild variant="crisisSoft" className="min-h-12 rounded-2xl">
          <a href={`sms:${CRISIS_LIFELINE_NUMBER}`} data-testid="craving-text-988">
            <MessageSquare className="mr-1.5 h-4 w-4" aria-hidden="true" /> {c.text}
          </a>
        </Button>
      </div>
      <Button asChild variant="outline" className="min-h-11 w-full rounded-2xl border-destructive/40 text-destructive">
        <a href="tel:911" data-testid="craving-call-911">
          <Phone className="mr-1.5 h-4 w-4" aria-hidden="true" /> {c.call911}
        </a>
      </Button>
      {sent ? (
        <p className="rounded-2xl bg-secondary p-3 text-sm" data-testid="craving-tell-sent">{c.tellSent}</p>
      ) : (
        <Button variant="outline" className={row} onClick={tell} data-testid="craving-tell-team">
          <BellRing className="mr-2 h-4 w-4" aria-hidden="true" /> {c.tell}
        </Button>
      )}
      <Button asChild variant="outline" className={row}>
        <Link to="/safety-plan" data-testid="craving-safety-plan">
          <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" /> {c.plan}
        </Link>
      </Button>
      <Button
        variant="outline"
        className={row}
        aria-expanded={open === "naloxone"}
        onClick={() => setOpen(open === "naloxone" ? null : "naloxone")}
        data-testid="craving-naloxone"
      >
        <ShieldPlus className="mr-2 h-4 w-4" aria-hidden="true" /> {c.naloxone}
      </Button>
      {open === "naloxone" && (
        <div className="space-y-2 rounded-2xl border border-dashed p-3 text-sm" data-testid="craving-naloxone-panel">
          <p className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {c.naloxoneDemo}
          </p>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/naloxone">{c.naloxoneOpen}</Link>
          </Button>
        </div>
      )}
      <Button
        variant="outline"
        className={row}
        aria-expanded={open === "ride"}
        onClick={() => setOpen(open === "ride" ? null : "ride")}
        data-testid="craving-ride"
      >
        <Bus className="mr-2 h-4 w-4" aria-hidden="true" /> {c.ride}
      </Button>
      {open === "ride" && (
        <ul className="space-y-2" data-testid="craving-ride-panel">
          {rides.length === 0 ? (
            <li className="rounded-2xl border border-dashed p-3 text-sm">{c.rideEmpty}</li>
          ) : (
            rides.map((r) => (
              <li key={r.id} className="rounded-2xl border p-3 text-sm">
                <Link
                  to="/resources/$categoryId/$orgId"
                  params={{ categoryId: r.categoryId, orgId: r.id }}
                  className="font-semibold underline"
                >
                  {r.name}
                </Link>
                <p className="text-muted-foreground">{r.description}</p>
                {/\d/.test(r.phone ?? "") && (
                  <a href={`tel:${r.phone}`} className="text-primary underline">
                    {r.phone}
                  </a>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </Card>
  );
}
