// §Advocate Build 2 item 2 — one appointments surface for advocates.
//
// Reads: `advocateSchedule` (upcoming, unchanged) + `advocateScheduleHistory`.
// Both apply the same Part 2 rule — a generic "Appointment" label and a
// generic "Group session" label for SUD-track groups unless the live
// consent-conditional disclosure exception is in force.
//
// Writes: RSVP and reschedule are gated on `advocateCanActOnSchedule`
// (`care_plan_participation_write` → AHCD agent and conservator only), and
// reschedule goes through `rescheduleAppointment`, the same store path the
// patient's own Appointments tab uses. No parallel booking mechanism exists.
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Users, Check, X, Info, Unlock, History } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { ADVOCATE_ACTOR_ROLE, advocateRescheduleSlots } from "@/lib/patientBooking";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { PART2_DISCLOSED_BADGE_LABEL, PART2_DISCLOSED_MESSAGE } from "@/lib/documents";

import { CancelRequestControl } from "@/components/scheduling/VisitActions";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.34b2dc9be9dd": {
    "en": "Reschedule",
    "es": "Reprogramar"
  },
  "ui.77dfd2135f4d": {
    "en": "Cancel",
    "es": "Cancelar"
  },
  "ui.969a2df3d305": {
    "en": "Attending",
    "es": "Asistiendo"
  },
  "ui.7d06dcaa4875": {
    "en": "Can't make it",
    "es": "No podré asistir"
  },
  "ui.1f3f4957c553": {
    "en": "Appointments",
    "es": "Citas"
  },
  "ui.523baab918ef": {
    "en": "Upcoming",
    "es": "Próximas"
  },
  "ui.aa4a66b0597b": {
    "en": "Nothing scheduled right now.",
    "es": "No hay nada programado por ahora."
  },
  "ui.b6c935d4f3c7": {
    "en": "min",
    "es": "min"
  },
  "ui.90ccd6497400": {
    "en": "History",
    "es": "Historial"
  },
  "ui.34f432fe6379": {
    "en": "No past visits yet.",
    "es": "Aún no hay visitas anteriores."
  }
} as const;


function Part2Notice() {
  return (
    <div className="mt-3 space-y-2" data-testid="advocate-part2-disclosed">
      <Badge variant="outline" className="gap-1">
        <Unlock className="h-3 w-3" /> {PART2_DISCLOSED_BADGE_LABEL}
      </Badge>
      <p className="flex gap-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {PART2_DISCLOSED_MESSAGE}
      </p>
    </div>
  );
}

function RescheduleControl({ linkId, apptId }: { linkId: string; apptId: string }) {
  const { lang: screenLang } = useI18n();

  const [open, setOpen] = useState(false);
  const options = useEhr(() =>
    open ? advocateRescheduleSlots(linkId, apptId) : undefined,
  );

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-1.5 h-4 w-4" /> {SCREEN_COPY["ui.34b2dc9be9dd"][screenLang]} </Button>
    );
  }

  const slots = options?.slots.slice(0, 8) ?? [];
  return (
    <div className="w-full space-y-2" data-testid="advocate-reschedule-slots">
      {slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {options?.reason ?? "No times are open right now."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="secondary"
              onClick={() => {
                try {
                  const appt = AdelanteEHR.listAppointments().find((a) => a.id === apptId);
                  const r = runAction(
                    "advocate_reschedule",
                    { role: ADVOCATE_ACTOR_ROLE, staffId: linkId, staffName: "Advocate" },
                    appt ? AdelanteEHR.getPatient(appt.patientId) : undefined,
                    { args: [{ linkId, apptId, start: s }] },
                  );
                  if (!r.ok) throw new Error(r.reason);
                  toast.success("Appointment moved.");
                  setOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not move that appointment.");
                }
              }}
            >
              <ClientDate
                value={s}
                options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }}
              />
            </Button>
          ))}
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        {SCREEN_COPY["ui.77dfd2135f4d"][screenLang]} </Button>
    </div>
  );
}

function RsvpControl({ linkId, apptId }: { linkId: string; apptId: string }) {
  const { lang: screenLang } = useI18n();

  const rsvp = useEhr(() => AdelanteEHR.advocateRsvpFor(linkId, apptId));
  const send = (response: "yes" | "no") => {
    try {
      AdelanteEHR.advocateRsvpAppointment(linkId, apptId, response);
      toast.success(response === "yes" ? "Marked as attending." : "Marked as not attending.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record that.");
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant={rsvp?.response === "yes" ? "default" : "outline"}
        onClick={() => send("yes")}
      >
        <Check className="mr-1 h-3.5 w-3.5" /> {SCREEN_COPY["ui.969a2df3d305"][screenLang]} </Button>
      <Button
        size="sm"
        variant={rsvp?.response === "no" ? "default" : "outline"}
        onClick={() => send("no")}
      >
        <X className="mr-1 h-3.5 w-3.5" /> {SCREEN_COPY["ui.7d06dcaa4875"][screenLang]} </Button>
    </div>
  );
}

export function AdvocateAppointmentsPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const upcoming = useEhr(() => AdelanteEHR.advocateSchedule(linkId));
  const history = useEhr(() => AdelanteEHR.advocateScheduleHistory(linkId));
  const canAct = useEhr(() => AdelanteEHR.advocateCanActOnSchedule(linkId));

  if (!upcoming.allowed) {
    return (
      <Card className="p-5 text-sm text-muted-foreground" data-testid="advocate-upcoming">
        {upcoming.reason}
      </Card>
    );
  }

  return (
    <Card className="p-5" data-testid="advocate-upcoming">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <CalendarClock className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.1f3f4957c553"][screenLang]} </h2>
      {upcoming.part2Disclosed && <Part2Notice />}

      <h3 className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {SCREEN_COPY["ui.523baab918ef"][screenLang]} </h3>
      {upcoming.items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{SCREEN_COPY["ui.aa4a66b0597b"][screenLang]}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {upcoming.items.map((item) => (
            <li
              key={`${item.kind}_${item.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <span className="flex items-center gap-2">
                {item.kind === "group" ? (
                  <Users className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                )}
                <span>
                  <span className="font-medium text-navy">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.durationMin} {SCREEN_COPY["ui.b6c935d4f3c7"][screenLang]} {item.modality ? ` · ${item.modality}` : ""}
                    {item.locationName ? ` · ${item.locationName}` : ""}
                  </span>
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                <ClientDate value={item.start} />
              </span>
              {/* Actions exist only for the authority tiers, and only for
                  one-to-one appointments — group enrollment is a clinical
                  admission decision, not a scheduling one. */}
              {canAct && item.kind === "appointment" && (
                <div
                  className="flex w-full flex-wrap items-center gap-2"
                  data-testid="advocate-appt-actions"
                >
                  <RsvpControl linkId={linkId} apptId={item.id} />
                  <RescheduleControl linkId={linkId} apptId={item.id} />
                  <AdvocateCancel linkId={linkId} apptId={item.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <History className="h-3.5 w-3.5" /> {SCREEN_COPY["ui.90ccd6497400"][screenLang]} </h3>
      {history.items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{SCREEN_COPY["ui.34f432fe6379"][screenLang]}</p>
      ) : (
        <ul className="mt-2 space-y-2" data-testid="advocate-history">
          {history.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-sm"
            >
              <span>
                <span className="font-medium text-navy">{item.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.durationMin} {SCREEN_COPY["ui.b6c935d4f3c7"][screenLang]} {item.modality ? ` · ${item.modality}` : ""}
                  {item.locationName ? ` · ${item.locationName}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {item.status.replace(/_/g, " ")}
                </Badge>
                <ClientDate value={item.start} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Clinical notes, medications and messages are never visible to advocates.{" "}
        {upcoming.part2Disclosed
          ? "Substance-use treatment information is protected under 42 CFR Part 2 and is shown here only because of the disclosure authorization noted above."
          : "Substance-use treatment information is protected under 42 CFR Part 2 whatever your authorization."}
        {!canAct &&
          " Your authorization is view-only, so appointments can't be changed from here — ask the care team."}
      </p>
    </Card>
  );
}

function AdvocateCancel({ linkId, apptId }: { linkId: string; apptId: string }) {
  const appt = useEhr(() => AdelanteEHR.listAppointments().find((a) => a.id === apptId));
  if (!appt) return null;
  return (
    <CancelRequestControl
      appt={appt}
      onRequest={(r) => AdelanteEHR.advocateRequestCancel(linkId, apptId, r)}
    />
  );
}
