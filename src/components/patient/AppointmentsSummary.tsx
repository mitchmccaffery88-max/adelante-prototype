// §P1 My Care de-clutter — one cohesive appointments view.
//
// My Care had two half-views of the same data: a "Next session" card with a
// Reschedule button, and flat Upcoming/History lists with no actions. Neither
// told you the visit type or whether it was video, phone, or in person. Both
// are gone; this is the single summary, and it lives on the Appointments
// surface next to the booking flow rather than on My Care.
//
// Reschedule reuses the existing real flow — `/schedule?reschedule=<id>`
// prefills the service, modality, clinician and location and rebooks against
// the clinician's live availability. Nothing new was invented for it.
import { Link } from "@tanstack/react-router";
import { Building2, CalendarClock, CalendarPlus, MapPin, Phone, Video } from "lucide-react";
import { AdelanteEHR, useEhr, type Appointment } from "@/lib/ehr";
import { mapsSearchUrl } from "@/lib/communityResources";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import {
  apptJoinUrl,
  apptPrepTip,
  joinWindowState,
  type ApptModality,
} from "@/lib/apptPrep";

const MODALITY: Record<ApptModality, { label: string; icon: typeof Video }> = {
  video: { label: "Video", icon: Video },
  phone: { label: "Phone", icon: Phone },
  in_person: { label: "In person", icon: Building2 },
};

function ApptRow({ appt, past }: { appt: Appointment; past?: boolean }) {
  const clinician = AdelanteEHR.getClinician(appt.clinicianId);
  const service = appt.serviceType ? AdelanteEHR.getServiceType(appt.serviceType) : undefined;
  const location = appt.locationId ? AdelanteEHR.getLocation(appt.locationId) : undefined;
  const mod = MODALITY[(appt.modality ?? "video") as ApptModality] ?? MODALITY.video;
  const ModIcon = mod.icon;
  const directions = location
    ? mapsSearchUrl([location.address, location.city].filter(Boolean).join(", "))
    : null;
  return (
    <Card className="p-4" data-testid="appointment-row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-navy">
            <ClientDate
              value={appt.start}
              options={{
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }}
            />
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {service?.label ?? "Visit"}
            {clinician ? ` · ${clinician.name}` : ""} · {appt.durationMin} min
          </div>
          {appt.modality === "in_person" && location && (
            <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 text-teal" />
              <span>
                {location.name} — {location.address}, {location.city}
                {location.room ? ` · ${location.room}` : ""}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <ModIcon className="h-3 w-3" /> {mod.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize">
              {appt.status.replace(/_/g, " ")}
            </Badge>
          </div>
          {/* §Build A item 4 — real join action for video visits. */}
          {!past && appt.status !== "cancelled" && (appt.modality ?? "video") === "video" && (
            <JoinCallButton appt={appt} />
          )}
          {/* §Small UI gaps batch item 5 — honest directions: a maps SEARCH on
              the real location address, exactly the Resources pattern. No
              fabricated coordinates; hidden when there is no real address. */}
          {appt.modality === "in_person" && directions && (
            <Button asChild size="sm" variant="outline" className="min-h-11" data-testid="appt-directions">
              <a href={directions} target="_blank" rel="noreferrer">
                <MapPin className="mr-1.5 h-4 w-4" /> Directions
              </a>
            </Button>
          )}
          {!past && appt.status !== "cancelled" && (
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link to="/schedule" search={{ reschedule: appt.id }}>
                <CalendarClock className="mr-1.5 h-4 w-4" /> Reschedule
              </Link>
            </Button>
          )}
        </div>
      </div>
      {/* §Build A item 4 — the same prep tip Home's next-appointment card
          shows, now consistently on every upcoming visit. */}
      {!past && appt.status !== "cancelled" && (
        <p className="mt-3 rounded-2xl bg-secondary p-3 text-sm" data-testid="appointment-prep-tip">
          {apptPrepTip(appt.modality)}
        </p>
      )}
    </Card>
  );
}

function JoinCallButton({ appt }: { appt: Appointment }) {
  const state = joinWindowState(appt.start, appt.durationMin);
  const { url, real } = apptJoinUrl(appt);
  if (state === "over") return null;
  if (state === "early") {
    return (
      <Button size="sm" variant="outline" className="min-h-11" disabled data-testid="join-call-early">
        <Video className="mr-1.5 h-4 w-4" /> Join opens 15 min before
      </Button>
    );
  }
  return (
    <Button asChild size="sm" className="min-h-11" data-testid="join-call-button">
      <a href={url} target="_blank" rel="noreferrer">
        <Video className="mr-1.5 h-4 w-4" /> {real ? "Join video call" : "Join video call (demo room)"}
      </a>
    </Button>
  );
}

/** Group upcoming visits by modality so "what kind, and how" reads at a glance. */
function ModalityGroup({ appts, modality }: { appts: Appointment[]; modality: ApptModality }) {
  const rows = appts.filter((a) => (a.modality ?? "video") === modality);
  if (rows.length === 0) return null;
  const mod = MODALITY[modality];
  const Icon = mod.icon;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {mod.label}
        <span className="font-normal normal-case tracking-normal">({rows.length})</span>
      </h3>
      {rows.map((a) => (
        <ApptRow key={a.id} appt={a} />
      ))}
    </section>
  );
}

export function AppointmentsSummary({ patientId }: { patientId: string }) {
  const appts = useEhr(() => AdelanteEHR.appointmentsForPatient(patientId));
  const now = Date.now();
  const upcoming = [...appts]
    .filter((a) => new Date(a.start).getTime() > now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const past = [...appts]
    .filter((a) => new Date(a.start).getTime() <= now)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))
    .slice(0, 8);

  return (
    <div className="space-y-6" data-testid="appointments-summary">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-navy">Upcoming</h2>
          <Badge variant="outline" className="text-[10px]">
            {upcoming.length} scheduled
          </Badge>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarPlus}
            title="Nothing scheduled yet"
            description="Use One-on-one visit or Groups above to book a time."
          />
        ) : (
          <div className="space-y-5">
            <ModalityGroup appts={upcoming} modality="in_person" />
            <ModalityGroup appts={upcoming} modality="video" />
            <ModalityGroup appts={upcoming} modality="phone" />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg text-navy">Past visits</h2>
        {past.length === 0 ? (
          <EmptyState compact title="No past visits yet" />
        ) : (
          past.map((a) => <ApptRow key={a.id} appt={a} past />)
        )}
      </div>
    </div>
  );
}
