// §Scheduling S4 — the coordination workspaces' Scheduling tile: upcoming
// visits for my caseload (coordinator: every clinician, with a filter),
// appointment requests, and "Book a visit". No clinician calendar needed.
import { useState } from "react";
import { AdelanteEHR, APPT_REQUEST_BOOK_AS, useEhr } from "@/lib/ehr";
import { bookingRightFor } from "@/lib/bookingRights";
import { openBookVisit, upcomingForScheduling, visitTypeLabel, type BookingActor } from "@/lib/bookingFlow";
import { AppointmentRequestsCard } from "@/components/scheduling/AppointmentRequestsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function SchedulingTile({ actor }: { actor: BookingActor }) {
  const right = bookingRightFor(actor.role);
  const [filter, setFilter] = useState("all");
  const visits = useEhr(() => upcomingForScheduling(actor, filter === "all" ? undefined : filter).slice(0, 15));
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  return (
    <div className="space-y-3" data-testid="scheduling-tile">
      <div className="flex flex-wrap items-center gap-2">
        {right.scope !== "none" && <Button size="sm" onClick={() => openBookVisit()} data-testid="scheduling-book">Book a visit</Button>}
        {right.scope === "any" && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-48" aria-label="Clinician filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clinicians</SelectItem>
              {clinicians.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{right.scope === "any" ? "Upcoming visits" : "Upcoming visits — my caseload"}</h4>
        {visits.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming visits.</p> : (
          <ul className="divide-y rounded border text-sm">
            {visits.map((a) => {
              const p = patients.find((x) => x.id === a.patientId);
              const c = clinicians.find((x) => x.id === a.clinicianId);
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate"><span className="font-medium">{p ? `${p.firstName} ${p.lastName}` : "Patient"}</span> · {visitTypeLabel(a.serviceType, actor.role)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c?.name ?? "Clinician"} · {new Date(a.start).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <AppointmentRequestsCard onBook={(pid, kind, requestId) => openBookVisit({ patientId: pid, serviceType: APPT_REQUEST_BOOK_AS[kind], requestId })} />
    </div>
  );
}
