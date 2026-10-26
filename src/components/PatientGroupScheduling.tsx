// §Group sessions — patient-facing group scheduling.
//
// Two distinct things live here, and the difference matters:
//   1. "Your group calendar" — read-only upcoming occurrences for groups the
//      patient is ALREADY enrolled in (both categories; seeing what you are
//      enrolled in is not the same as enrolling yourself).
//   2. "Open groups you can join" — self-service enrollment, restricted to the
//      self-service categories (`open_psychoeducational` and the billable
//      `skills_education`). `sud_clinical_preauth` groups must never surface
//      here; the store enforces this too (`openGroupsForPatient` +
//      `assertEnrollmentAllowed`), this is not a UI-only filter. Billability
//      is deliberately NOT shown to patients.
//
// Both paths require the care-plan group-eligibility flag, which staff set.
// PLACEHOLDER: curriculum tags and eligibility criteria are still provisional
// pending Christi/SME content; categories and billing codes are now real.
//
// FUTURE: an Authorized Representative / Collateral (advocate) acting for the
// patient will reuse this surface — the actor is passed to the store, which is
// the single place that decides who may enroll.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  formatLocationAddress,
  isVirtualGroupModality,
  useEhr,
} from "@/lib/ehr";
import { nextOccurrenceForGroup } from "@/lib/groupMetrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { Users, CalendarClock, MapPin } from "lucide-react";
import { patientGroupLabel } from "@/lib/groupJoinView";
import { patientGroupCatalog } from "@/lib/groupRequests";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { useI18n } from "@/lib/i18n";
import { StatusChip } from "@/components/ui/status-chip";


export function PatientGroupScheduling({ patientId }: { patientId: string }) {
  const enrolled = useEhr(() => AdelanteEHR.groupsForPatient(patientId));

  const enrolledRows = useMemo(
    () =>
      enrolled.map((g) => ({
        group: g,
        starts: AdelanteEHR.groupOccurrenceStarts(g.id, 4),
      })),
    [enrolled],
  );

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg text-navy">Your group calendar</h2>
          <p className="text-xs text-muted-foreground">
            The next meetings for groups you're already part of.
          </p>
        </div>
        {enrolledRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're not in any groups right now. Your care team will let you know if a group would
            help.
          </p>
        ) : (
          <ul className="space-y-3">
            {enrolledRows.map(({ group, starts }) => {
              const loc = AdelanteEHR.getLocation(group.locationId);
              return (
                <li key={group.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal" />
                    <span className="font-medium text-navy">{group.topic}</span>
                  </div>
                  {group.description && (
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  )}
                  {loc && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {loc.name} — {formatLocationAddress(loc)}
                    </p>
                  )}
                  {starts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No meetings scheduled yet.</p>
                  ) : (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {starts.map((s) => {
                        // §Phase 6b — join link per meeting, only when virtual.
                        const virtual = isVirtualGroupModality(
                          AdelanteEHR.groupOccurrenceModality(group.id, s),
                        );
                        const room = virtual
                          ? AdelanteEHR.groupJoinLink(group.id, s)
                          : undefined;
                        return (
                          <li key={s} className="space-y-0.5">
                            <span className="flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5 text-teal" />
                              <ClientDate
                                value={s}
                                options={{
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                }}
                              />
                              <span>· {group.durationMin} min</span>
                            </span>
                            {virtual && (
                              <span className="block break-all pl-5">
                                {room ? (
                                  <a
                                    className="text-teal underline"
                                    href={room.joinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Join online
                                  </a>
                                ) : (
                                  "Meets online — your care team will share the join link."
                                )}
                              </span>
                            )}
                          </li>
                        );
                      })}

                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <AskToJoinGroups patientId={patientId} />
    </div>
  );
}
// 26 Oct (Mitch) — one list of groups the patient may see, each with ONE action:
// Join (open + every requirement met), Ask to join, or a status. Clinical and
// Part 2 requirements are never named; only self-actionable items are.
const GC = {
  en: {
    title: "Groups", intro: "Groups you can be part of. Pick one that fits you.", none: "No groups to show right now.",
    join: "Join", ask: "Ask to join", joined: "You're in this group", requested: "Requested — your care team is checking",
    sent: "We'll check with your care team. You'll get a message when you're added.",
    declined: "Your care team will talk with you about other options.",
    confirm: "Your care team will confirm this group is right for you.",
    confidentiality_ack: "This group asks everyone to sign a privacy promise. Your care team can send it to you.",
    telehealth_consent: "This group meets by video. You need to say yes to video visits first. Your care team can send the form.",
    in_person: "In person", video: "By video", phone: "By phone",
    en: "English", es: "Spanish", both: "English and Spanish", next: "Next meeting:", tbd: "Next meeting to be set",
    joinedToast: "You're in the group.",
  },
  es: {
    title: "Grupos", intro: "Grupos en los que puedes participar. Elige uno que te sirva.", none: "No hay grupos para mostrar ahora.",
    join: "Unirme", ask: "Pedir unirme", joined: "Ya estás en este grupo", requested: "Pedido — tu equipo de cuidado lo está revisando",
    sent: "Vamos a consultar con tu equipo de cuidado. Recibirás un mensaje cuando te agreguen.",
    declined: "Tu equipo de cuidado hablará contigo sobre otras opciones.",
    confirm: "Tu equipo de cuidado confirmará que este grupo es bueno para ti.",
    confidentiality_ack: "Este grupo pide que todos firmen una promesa de privacidad. Tu equipo de cuidado te la puede enviar.",
    telehealth_consent: "Este grupo se reúne por video. Primero tienes que decir que sí a las visitas por video. Tu equipo de cuidado te puede enviar el formulario.",
    in_person: "En persona", video: "Por video", phone: "Por teléfono",
    en: "Inglés", es: "Español", both: "Inglés y español", next: "Próxima reunión:", tbd: "La próxima reunión aún no tiene fecha",
    joinedToast: "Ya estás en el grupo.",
  },
} as const;

function AskToJoinGroups({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const c = GC[lang === "es" ? "es" : "en"];
  const rows = useEhr(() => patientGroupCatalog(patientId));
  const declined = useEhr(() => AdelanteEHR.listGroupJoinRequests({ patientId, status: "declined" }));
  const [sentId, setSentId] = useState<string>();
  const actor = { role: PATIENT_ACTOR_ROLE, staffId: patientId, staffName: "Patient (self)" };
  const act = (id: "patient_group_join" | "patient_group_ask", sessionId: string) => {
    const r = runAction(id, actor, AdelanteEHR.getPatient(patientId), { args: [actor, patientId, sessionId] });
    if (!r.ok) { toast.error(r.reason); return; }
    if (id === "patient_group_ask") setSentId(sessionId); else toast.success(c.joinedToast);
  };
  return (
    <Card className="p-6 space-y-4" data-testid="ask-to-join">
      <div>
        <h2 className="font-display text-lg text-navy">{c.title}</h2>
        <p className="text-sm text-muted-foreground">{c.intro}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-base text-muted-foreground">{c.none}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ group: g, action, selfNeeds }) => {
            const next = nextOccurrenceForGroup(g.id);
            const wasDeclined = action === "ask" && declined.some((r) => r.sessionId === g.id);
            return (
              <li key={g.id} className="rounded-lg border p-4 space-y-2" data-testid="patient-group-row" data-action={action}>
                <span className="font-medium text-navy block">{patientGroupLabel(g)}</span>
                {g.description && g.category !== "sud_clinical_preauth" && <p className="text-base text-muted-foreground">{g.description}</p>}
                <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-1.5">
                  <CalendarClock className="h-4 w-4 text-teal" aria-hidden />
                  {next ? (<>{c.next} <ClientDate value={next} options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} /></>) : c.tbd}
                </p>
                <p className="text-sm text-muted-foreground">
                  {c[g.modality]} · {c[g.language ?? "en"]}
                </p>
                {action === "joined" && <StatusChip lang={lang === "es" ? "es" : "en"} state="done" label={c.joined} />}
                {action === "requested" && (
                  <div className="space-y-1">
                    <StatusChip lang={lang === "es" ? "es" : "en"} state="team" label={c.requested} />
                    {sentId === g.id && <p className="text-base text-foreground" role="status">{c.sent}</p>}
                  </div>
                )}
                {action === "ask" && (
                  <div className="space-y-2">
                    {wasDeclined && <p className="text-sm text-muted-foreground">{c.declined}</p>}
                    {selfNeeds.map((n) => (
                      <p key={n} className="text-sm text-muted-foreground">{c[n as "confidentiality_ack" | "telehealth_consent"]}</p>
                    ))}
                    <p className="text-sm text-muted-foreground">{c.confirm}</p>
                    <Button variant="outline" onClick={() => act("patient_group_ask", g.id)}>{c.ask}</Button>
                  </div>
                )}
                {action === "join" && <Button onClick={() => act("patient_group_join", g.id)}>{c.join}</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
