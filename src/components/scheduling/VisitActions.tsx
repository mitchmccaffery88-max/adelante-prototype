// §Cancel/no-show — shared visit controls.
// Staff: cancel (required reason), no-show on past unattended visits, confirm
// or decline a patient/advocate cancel request, late-cancel label (draft).
// Patient / advocate: "Cancel" request with an optional reason.
// No ASAM wording anywhere: an ASAM-linked visit reads as a plain visit.
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarX, CheckCircle2, UserCheck, UserX } from "lucide-react";
import {
  AdelanteEHR,
  STAFF_CANCEL_REASON_LABEL,
  useEhr,
  type Appointment,
  type StaffCancelReason,
} from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { LATE_CANCEL_LABEL } from "@/lib/lateCancel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";

export function LateCancelBadge({ appt }: { appt: Appointment }) {
  if (!appt.cancellation?.lateCancel) return null;
  return (
    <Badge variant="outline" className="text-[10px]" data-testid="late-cancel-label" title="Draft label — no fee logic">
      {LATE_CANCEL_LABEL} · draft
    </Badge>
  );
}

function run(fn: () => void, ok: string) {
  try {
    fn();
    toast.success(ok);
  } catch (e) {
    toast.error((e as Error).message);
  }
}

export function StaffVisitActions({ appt }: { appt: Appointment }) {
  const actor = useActingStaff();
  const who = { name: actor.staffName, role: actor.role, id: actor.staffId };
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<StaffCancelReason | "">("");
  const [note, setNote] = useState("");
  const [moving, setMoving] = useState(false);
  const [newStart, setNewStart] = useState("");
  const canAct = AdelanteEHR.appointmentActionRoles().includes(actor.role);
  const past = +new Date(appt.start) <= Date.now();

  if (appt.status === "rescheduled")
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="visit-rescheduled">
        <Badge variant="secondary" className="text-[10px]">Rescheduled</Badge>
        {appt.rescheduledToId && (() => {
          const n = AdelanteEHR.listAppointments().find((x) => x.id === appt.rescheduledToId);
          return n ? <span>moved to <ClientDate value={n.start} options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} /></span> : null;
        })()}
      </div>
    );
  if (appt.status === "cancelled" || appt.status === "late_cancel")
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" data-testid="visit-cancelled">
        <Badge variant="secondary" className="text-[10px]">{appt.status === "late_cancel" ? "Late cancel" : "Cancelled"}</Badge>
        {appt.status !== "late_cancel" && <LateCancelBadge appt={appt} />}
        {appt.cancellation && (
          <span>
            {STAFF_CANCEL_REASON_LABEL[appt.cancellation.reason]} · {appt.cancellation.byName}
          </span>
        )}
      </div>
    );
  if (appt.status === "no_show")
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="visit-no-show">
        <Badge variant="secondary" className="text-[10px]">No-show</Badge>
        {appt.noShow && <span>marked by {appt.noShow.byName}</span>}
      </div>
    );
  if (appt.status === "attended")
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="visit-attended">
        <Badge variant="secondary" className="text-[10px]">Attended</Badge>
        {appt.attendedBy && <span>marked by {appt.attendedBy.byName}</span>}
      </div>
    );
  if (!canAct) return null;
  if (appt.status === "checked_in")
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="visit-checked-in">
        <Badge variant="secondary" className="text-[10px]">Checked in</Badge>
        <Button size="sm" variant="outline" className="min-h-9" onClick={() => run(() => AdelanteEHR.markAppointmentAttended(appt.id, who), "Marked attended.")}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Attended
        </Button>
      </div>
    );
  if (appt.status !== "scheduled") return null;
  const sameDay = new Date(appt.start).toDateString() === new Date().toDateString();

  const pending = appt.cancelRequest?.status === "pending" ? appt.cancelRequest : undefined;
  return (
    <div className="w-full space-y-2" data-testid="staff-visit-actions">
      {pending && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs" data-testid="cancel-request-pending">
          <p>
            <span className="font-medium">Cancel requested</span> by {pending.byKind === "advocate" ? `advocate ${pending.byName}` : pending.byName}
            {pending.reason ? ` — "${pending.reason}"` : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="min-h-9" onClick={() => run(() => AdelanteEHR.resolveCancelRequest(appt.id, "confirm", who), "Visit cancelled. Patient notified.")}>
              Confirm cancel
            </Button>
            <Button size="sm" variant="outline" className="min-h-9" onClick={() => run(() => AdelanteEHR.resolveCancelRequest(appt.id, "decline", who), "Request declined.")}>
              Decline
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {sameDay && (
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => run(() => AdelanteEHR.checkInAppointment(appt.id, who), "Checked in.")}>
            <UserCheck className="mr-1.5 h-4 w-4" /> Check in
          </Button>
        )}
        {past && (
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => run(() => AdelanteEHR.markAppointmentAttended(appt.id, who), "Marked attended.")}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Attended
          </Button>
        )}
        {!past && !pending && (
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => setMoving((v) => !v)}>
            <CalendarClock className="mr-1.5 h-4 w-4" /> Reschedule
          </Button>
        )}
        {past ? (
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => run(() => AdelanteEHR.markAppointmentNoShow(appt.id, who), "Marked no-show. Patient notified.")}>
            <UserX className="mr-1.5 h-4 w-4" /> No-show
          </Button>
        ) : (
          !pending && (
            <Button size="sm" variant="outline" className="min-h-9" onClick={() => setOpen((v) => !v)}>
              <CalendarX className="mr-1.5 h-4 w-4" /> Cancel visit
            </Button>
          )
        )}
      </div>
      {moving && !past && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-2" data-testid="staff-reschedule-form">
          <label className="text-xs font-medium">
            New date and time
            <input aria-label="New visit time" type="datetime-local" className="mt-1 block rounded-md border bg-background p-2 text-sm" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </label>
          <Button
            size="sm"
            className="min-h-9"
            disabled={!newStart}
            onClick={() =>
              run(() => {
                AdelanteEHR.staffRescheduleAppointment(appt.id, new Date(newStart).toISOString(), who);
                setMoving(false);
              }, "Visit rescheduled. Patient notified.")
            }
          >
            Confirm reschedule
          </Button>
        </div>
      )}
      {open && !past && (
        <div className="space-y-2 rounded-md border p-2" data-testid="staff-cancel-form">
          <label className="block text-xs font-medium">
            Reason (required)
            <select
              aria-label="Cancel reason"
              className="mt-1 block w-full rounded-md border bg-background p-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as StaffCancelReason)}
            >
              <option value="">Choose…</option>
              {(Object.keys(STAFF_CANCEL_REASON_LABEL) as StaffCancelReason[]).map((k) => (
                <option key={k} value={k}>{STAFF_CANCEL_REASON_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <Textarea aria-label="Cancel note" placeholder={reason === "other" ? "Describe the reason (required)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            size="sm"
            className="min-h-9"
            disabled={!reason}
            onClick={() =>
              run(() => {
                AdelanteEHR.staffCancelAppointment(appt.id, { reason: reason as StaffCancelReason, note, actor: who });
                setOpen(false);
              }, "Visit cancelled. Patient and clinician notified.")
            }
          >
            Confirm cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/** Staff chart card: the patient's 1:1 visits with cancel / no-show actions. */
export function PatientVisitsCard({ patientId }: { patientId: string }) {
  const appts = useEhr(() => AdelanteEHR.appointmentsForPatient(patientId));
  const since = Date.now() - 30 * 86400000;
  const rows = appts.filter((a) => +new Date(a.start) >= since).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  return (
    <Card className="space-y-3 p-4" data-testid="patient-visits-card">
      <h3 className="text-sm font-medium text-navy">Visits (last 30 days and upcoming)</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No visits.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => {
            const svc = a.serviceType ? AdelanteEHR.getServiceType(a.serviceType) : undefined;
            const clin = AdelanteEHR.getClinician(a.clinicianId);
            return (
              <li key={a.id} className="space-y-2 rounded-md border p-3 text-sm" data-testid="patient-visit-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    <ClientDate value={a.start} options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {svc?.label ?? "Visit"}{clin ? ` · ${clin.name}` : ""}
                  </span>
                </div>
                <StaffVisitActions appt={a} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Patient / advocate: ask to cancel. Staff confirm. */
export function CancelRequestControl({
  appt,
  onRequest,
}: {
  appt: Appointment;
  onRequest: (reason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (appt.cancelRequest?.status === "pending")
    return (
      <p className="text-xs font-medium text-navy" data-testid="cancel-requested-notice">
        Cancel requested — your care team will confirm.
      </p>
    );
  if (appt.status !== "scheduled" || +new Date(appt.start) <= Date.now()) return null;
  return open ? (
    <div className="w-full space-y-2" data-testid="cancel-request-form">
      <Textarea aria-label="Reason (optional)" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" className="min-h-11" onClick={() => run(() => { onRequest(reason); setOpen(false); }, "Cancel requested — your care team will confirm.")}>
          Send cancel request
        </Button>
        <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
          Keep visit
        </Button>
      </div>
    </div>
  ) : (
    <Button size="sm" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
      <CalendarX className="mr-1.5 h-4 w-4" /> Cancel
    </Button>
  );
}
