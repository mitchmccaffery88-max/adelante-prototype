// §Pre-release build 3 — real appointment booking for the reentry first visits.
//
// Before this build the "mental health appointment" step only recorded typed
// provider/location strings on the care plan. This card books an ACTUAL
// Appointment through `AdelanteEHR.bookPreReleaseAppointment`, which delegates
// to the same `bookAppointment` the scheduling surfaces use (credential check,
// double-book check, reminders) and links the booking onto the care-plan row.
import { useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  REENTRY_APPT_SERVICE_TYPE,
  type CfAttribution,
  type PreReleaseEpisode,
  type ReentryAppointmentKind,
} from "@/lib/ehr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

const KINDS: { key: ReentryAppointmentKind; label: string }[] = [
  { key: "mental_health", label: "Mental health" },
  { key: "med_management", label: "Medication management" },
  { key: "sud", label: "SUD" },
];

export function PreReleaseAppointmentCard({
  episode,
  attribution,
  blockedReason,
  entryBlockedReason,
}: {
  episode: PreReleaseEpisode;
  attribution?: CfAttribution;
  /** Build-1 capacity gate reason, when it blocks consent-dependent steps. */
  blockedReason?: string;
  /** CF direct/proxy entry-scope reason, when this actor cannot write. */
  entryBlockedReason?: string;
}) {
  const plan = useEhr(() => AdelanteEHR.getReentryCarePlan(episode.id));
  const appointments = useEhr(() => AdelanteEHR.listAppointments());
  const [kind, setKind] = useState<ReentryAppointmentKind>("mental_health");
  const [clinicianId, setClinicianId] = useState("");
  const [start, setStart] = useState("");
  const [modality, setModality] = useState<"in_person" | "video" | "phone">("in_person");
  const [locationId, setLocationId] = useState("");

  const serviceType = REENTRY_APPT_SERVICE_TYPE[kind];
  const clinicians = useEhr(() => AdelanteEHR.cliniciansForService(serviceType));
  const locations = useEhr(() => AdelanteEHR.locationsForService(serviceType));
  const booked = (plan?.appointments ?? []).filter((a) => a.apptId);
  const disabled = Boolean(blockedReason) || Boolean(entryBlockedReason) || !attribution;

  const book = () => {
    if (!attribution) return;
    if (!clinicianId || !start) {
      toast.error("Pick a clinician and a date/time.");
      return;
    }
    try {
      AdelanteEHR.bookPreReleaseAppointment({
        episodeId: episode.id,
        kind,
        clinicianId,
        start,
        modality,
        ...(modality === "in_person" && locationId ? { locationId } : {}),
        attribution,
      });
      setStart("");
      toast.success("Appointment booked — it is now a real, trackable visit.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not book the appointment.");
    }
  };

  return (
    <Card className="p-4" data-testid="pre-release-appointment-card">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <CalendarClock className="h-4 w-4" /> First appointments
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Books a real appointment in the scheduling system — not a note on the plan. It appears on
        the clinician&apos;s schedule and on the member&apos;s reminders immediately.
      </p>

      {blockedReason && (
        <p
          data-testid="appointment-blocked"
          className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        >
          {blockedReason}
        </p>
      )}

      {booked.length > 0 && (
        <ul className="mb-3 space-y-1">
          {booked.map((a) => {
            const live = appointments.find((x) => x.id === a.apptId);
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span>
                  {KINDS.find((k) => k.key === a.kind)?.label ?? a.kind} ·{" "}
                  {new Date(a.start).toLocaleString()} · {a.providerName} · {a.location}
                </span>
                <Badge variant="outline">{live?.status ?? "booked"}</Badge>
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Appointment type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReentryAppointmentKind)}>
              <SelectTrigger data-testid="appt-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.key} value={k.key}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Clinician</Label>
            <Select value={clinicianId} onValueChange={setClinicianId}>
              <SelectTrigger data-testid="appt-clinician">
                <SelectValue placeholder="Clinician" />
              </SelectTrigger>
              <SelectContent>
                {clinicians.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date &amp; time</Label>
            <Input
              type="datetime-local"
              data-testid="appt-start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Modality</Label>
            <Select
              value={modality}
              onValueChange={(v) => setModality(v as "in_person" | "video" | "phone")}
            >
              <SelectTrigger data-testid="appt-modality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In person</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {modality === "in_person" && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger data-testid="appt-location">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button className="w-full" onClick={book} data-testid="book-pre-release-appointment">
              Book appointment
            </Button>
          </div>
        </div>
      )}
      {entryBlockedReason && (
        <p className="text-xs text-muted-foreground">
          {entryBlockedReason} Only {episode.cfCareManagerName} can book on this episode.
        </p>
      )}
    </Card>
  );
}
