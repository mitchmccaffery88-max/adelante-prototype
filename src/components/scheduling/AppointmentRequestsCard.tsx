// §Needs step 3 — appointment requests queue (staff). Requests are NOT
// bookings: staff confirm by booking a real slot through the existing booking
// flow (closes the request) or mark "contacted, not booked" with a reason.
// SUD assessment requests are Part 2 protected: shown only to ASAM task roles
// that pass the existing screeners_sud check for that patient.
import { useState } from "react";
import {
  AdelanteEHR,
  APPT_REQUEST_BOOKING_ROLES,
  APPT_REQUEST_STAFF_LABEL,
  useEhr,
  type AppointmentRequest,
  type AppointmentRequestKind,
  type Patient,
} from "@/lib/ehr";
import { ASAM_TASK_ROLES } from "@/lib/asam";
import { roleSeesAsam } from "@/lib/asamReporting";
import { useActingRole, useActingStaff, type StaffRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";

export function roleSeesApptRequest(role: StaffRole, patient: Patient, req: AppointmentRequest): boolean {
  if (!APPT_REQUEST_BOOKING_ROLES.includes(role) && req.kind !== "help_choose") return false;
  if (req.kind === "sud_assessment") return ASAM_TASK_ROLES.includes(role) && roleSeesAsam(role, patient);
  return true;
}

export function AppointmentRequestsCard({
  patientId,
  onBook,
}: {
  patientId?: string;
  onBook?: (patientId: string, kind: AppointmentRequestKind, requestId: string) => void;
}) {
  const [role] = useActingRole();
  const staff = useActingStaff();
  const rows = useEhr(() =>
    AdelanteEHR.listOpenAppointmentRequests().filter((r) => !patientId || r.patient.id === patientId),
  ).filter((r) => roleSeesApptRequest(role, r.patient, r.request));
  const history = useEhr(() => (patientId ? AdelanteEHR.listAppointmentRequests(patientId) : [])).filter(
    (r) => r.status !== "requested",
  );
  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (rows.length === 0 && history.length === 0 && !patientId) return null;

  return (
    <Card className="p-5" data-testid="appt-requests-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg text-navy">Appointment requests</h3>
        <Badge variant="outline">{rows.length} waiting</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Requested by the patient at intake — waiting for staff confirmation. Booking a slot closes the request.
      </p>
      {rows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No requests waiting.</p>}
      <ul className="mt-3 space-y-2">
        {rows.map(({ patient: p, request: r }) => (
          <li key={r.id} className="rounded-md border p-3 text-sm" data-testid="appt-request-row">
            <div className="font-medium">
              {!patientId && `${p.firstName} ${p.lastName} · `}
              {APPT_REQUEST_STAFF_LABEL[r.kind]}
            </div>
            <div className="text-xs text-muted-foreground">
              Requested <ClientDate value={r.createdAt} options={{ month: "short", day: "numeric" }} />
              {r.preferences?.days ? ` · days: ${r.preferences.days}` : ""}
              {r.preferences?.times ? ` · times: ${r.preferences.times}` : ""}
              {r.preferences?.modality ? ` · prefers ${r.preferences.modality === "video" ? "video" : "in person"}` : ""}
              {r.preferences ? " (draft)" : ""}
              {r.linkedAsamTaskId ? " · linked to the ASAM assessment task" : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {onBook && (
                <Button size="sm" onClick={() => onBook(p.id, r.kind, r.id)} data-testid="appt-request-book">
                  Book this
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setReasonFor(r.id); setReason(""); }}>
                Contacted, not booked
              </Button>
            </div>
            {reasonFor === r.id && (
              <div className="mt-2 flex gap-2">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      AdelanteEHR.markAppointmentRequestNotBooked(p.id, r.id, reason, {
                        id: staff.staffId,
                        name: staff.staffName,
                        role,
                      });
                      setReasonFor(null);
                      toast.success("Marked contacted, not booked");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not save");
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {patientId && !onBook && rows.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Book from the clinician workspace booking card.</p>
      )}
      {patient &&
        history
          .filter((r) => roleSeesApptRequest(role, patient, r))
          .map((r) => (
            <div key={r.id} className="mt-2 text-xs text-muted-foreground">
              {APPT_REQUEST_STAFF_LABEL[r.kind]} —{" "}
              {r.status === "booked" ? "booked" : `contacted, not booked: ${r.notBookedReason}`} by {r.closedBy}
            </div>
          ))}
    </Card>
  );
}
