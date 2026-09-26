// §Needs step 3 — per-service appointment state on My Care's appointment card.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { patientApptStates, patientFirstVisit, PATIENT_REQUEST_LABEL } from "@/lib/apptRequestStatus";
import { ClientDate } from "@/components/ClientDate";
import { useI18n } from "@/lib/i18n";

const DATE = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;

export function ApptRequestStates({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const es = lang === "es";
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const appts = useEhr(() => AdelanteEHR.appointmentsForPatient(patientId));
  const rows = patientApptStates(patient, appts);
  // Generic first visit (the ASAM task, never named): Part 2-safe wording.
  const first = useEhr(() => {
    const t = AdelanteEHR.openAsamWorkTask(patientId);
    return patientFirstVisit(t, t ? AdelanteEHR.asamVisitState(t.id) : undefined);
  });
  if (rows.length === 0 && !first) return null;
  return (
    <ul className="mt-3 space-y-2 border-t pt-3" data-testid="appt-request-states">
      {first && (
        <li className="text-sm" data-testid="appt-state-first-visit">
          {first.state === "pending" ? (
            <div className="font-medium">
              {es ? "Tu equipo de atención se comunicará contigo para programar una primera visita" : "Your care team will reach out to set up a first visit"}
            </div>
          ) : (
            <div className="font-medium">
              {es ? "Primera visita programada: " : "First visit scheduled: "}
              <ClientDate value={first.start} options={DATE} />
            </div>
          )}
        </li>
      )}
      {rows.map((r) => (
        <li key={r.kind} className="text-sm" data-testid={`appt-state-${r.kind}`}>
          <div className="font-medium">{PATIENT_REQUEST_LABEL[r.kind][es ? "es" : "en"]}</div>
          <div className="text-xs text-muted-foreground">
            {r.state === "requested" && (es ? "Solicitada — esperando confirmación del equipo" : "Requested — waiting for confirmation")}
            {r.state === "scheduled" && (<>{es ? "Programada: " : "Scheduled: "}<ClientDate value={r.start} options={DATE} /></>)}
            {r.state === "already_scheduled" && (<>{es ? "Ya programada para ti: " : "Already scheduled for you: "}<ClientDate value={r.start} options={DATE} /></>)}
            {r.state === "contacted" && (es ? "Tu equipo se comunicó contigo" : "Your care team reached out to you")}
          </div>
        </li>
      ))}
    </ul>
  );
}
