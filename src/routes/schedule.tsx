import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type ServiceType } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarPlus,
  ShieldCheck,
  Video,
  Phone,
  MapPin,
  Building2,
  CalendarClock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PatientGroupScheduling } from "@/components/PatientGroupScheduling";
import { AppointmentsSummary } from "@/components/patient/AppointmentsSummary";

// §P1 My Care de-clutter — "yours" is the new default landing tab: the
// summary of everything already booked. Booking is still one tap away.
type ScheduleTab = "yours" | "one_to_one" | "groups";
type ScheduleSearch = { reschedule?: string; tab?: ScheduleTab };

export const Route = createFileRoute("/schedule")({
  validateSearch: (s: Record<string, unknown>): ScheduleSearch => ({
    reschedule: typeof s.reschedule === "string" ? s.reschedule : undefined,
    tab:
      s.tab === "groups" || s.tab === "one_to_one" || s.tab === "yours" ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "My appointments — Adelante" },
      {
        name: "description",
        content:
          "See every appointment you have booked, reschedule it, or book a new visit with your Adelante care team — video, phone, or in person.",
      },
      { property: "og:title", content: "My appointments — Adelante" },
      {
        property: "og:description",
        content: "Your upcoming and past visits, with rescheduling and booking in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { reschedule: rescheduleId, tab: tabParam } = Route.useSearch();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const existing = useEhr(() =>
    rescheduleId
      ? AdelanteEHR.appointmentsForPatient(currentId).find((a) => a.id === rescheduleId)
      : undefined,
  );
  const isReschedule = Boolean(rescheduleId && existing);
  const serviceTypes = useEhr(() => AdelanteEHR.listServiceTypes());
  const [serviceType, setServiceType] = useState<ServiceType | "">(existing?.serviceType ?? "");
  const activeService = serviceTypes.find((s) => s.id === serviceType);
  const allowedModalities = activeService?.allowedModalities ?? ["video", "phone", "in_person"];
  const [modality, setModality] = useState<"video" | "phone" | "in_person">(
    existing?.modality ?? "video",
  );
  // If the picked service doesn't support current modality, snap to the first allowed.
  const effectiveModality = allowedModalities.includes(modality)
    ? modality
    : (allowedModalities[0] ?? "video");
  const locations = useEhr(() => AdelanteEHR.locationsForService(serviceType || undefined));
  const [locationId, setLocationId] = useState<string>(existing?.locationId ?? "");
  const clinicians = useEhr(() =>
    AdelanteEHR.cliniciansForService(serviceType || undefined, {
      locationId: effectiveModality === "in_person" ? locationId : undefined,
    }),
  );
  const [clinicianId, setClinicianId] = useState(existing?.clinicianId ?? "");
  // Reset clinician if the current one isn't in the filtered list.
  const clinicianStillValid = clinicians.some((c) => c.id === clinicianId);
  const effectiveClinicianId = clinicianStillValid ? clinicianId : (clinicians[0]?.id ?? "");
  const [selectedStart, setSelectedStart] = useState<string>("");
  // Three panes on one page: the appointments summary (default), the
  // untouched 1:1 booking flow, and group scheduling (view enrolled groups +
  // self-join OPEN groups only). A reschedule link jumps straight to booking.
  const [tab, setTab] = useState<ScheduleTab>(
    tabParam ?? (rescheduleId ? "one_to_one" : "yours"),
  );
  const [activeDayKey, setActiveDayKey] = useState<string>("");

  const availability = useEhr(() =>
    effectiveClinicianId
      ? AdelanteEHR.getClinicianAvailability(effectiveClinicianId, 14, {
          excludeApptId: isReschedule ? existing?.id : undefined,
        })
      : [],
  );

  const defaultDuration = activeService?.defaultDurationMin ?? existing?.durationMin ?? 50;
  const activeLocation = AdelanteEHR.getLocation(locationId);

  const dayGroups = useMemo(() => {
    const map = new Map<string, { date: Date; slots: typeof availability }>();
    for (const s of availability) {
      const d = new Date(s.start);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, { date: d, slots: [] });
      map.get(key)!.slots.push(s);
    }
    return Array.from(map.values()).slice(0, 14);
  }, [availability]);

  const activeDay = dayGroups.find((g) => g.date.toDateString() === activeDayKey) ?? dayGroups[0];

  if (!patient) return null;

  const submit = () => {
    if (!serviceType) {
      toast.error("Pick a service to continue.");
      return;
    }
    if (effectiveModality === "in_person" && !locationId) {
      toast.error("Pick a location for the in-person visit.");
      return;
    }
    if (!selectedStart || !effectiveClinicianId) {
      toast.error("Pick a time that works for you.");
      return;
    }
    try {
      if (isReschedule && existing) {
        AdelanteEHR.rescheduleAppointment(existing.id, selectedStart, {
          serviceType: serviceType as ServiceType,
          modality: effectiveModality,
          locationId: effectiveModality === "in_person" ? locationId : undefined,
          clinicianId: effectiveClinicianId,
        });
        toast.success("Session rescheduled", {
          description: "Your care team and you have been notified.",
        });
      } else {
        AdelanteEHR.bookAppointment({
          patientId: patient.id,
          clinicianId: effectiveClinicianId,
          start: selectedStart,
          durationMin: defaultDuration,
          serviceType: serviceType as ServiceType,
          modality: effectiveModality,
          locationId: effectiveModality === "in_person" ? locationId : undefined,
        });
        toast.success(t("schRequested"), {
          description:
            effectiveModality === "in_person" && activeLocation
              ? `In person at ${activeLocation.name}.`
              : t("schRequestedDesc"),
        });
      }
      // Land on the summary so the new booking is immediately visible.
      navigate({ to: "/schedule", search: { tab: "yours" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book that slot.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("schBack")}
        </Link>
      </Button>
      <header className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">
          {isReschedule ? "Reschedule" : "Appointments"}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">
          {isReschedule ? "Pick a new time" : "My appointments"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isReschedule
            ? "These are your counselor's open times pulled from their live calendar."
            : "Everything you have booked, plus a place to book something new."}
        </p>
      </header>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Scheduling type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "yours"}
          onClick={() => setTab("yours")}
          className={
            "rounded-md border px-3 py-1.5 text-sm " +
            (tab === "yours" ? "border-teal bg-teal/10 text-navy font-medium" : "bg-card")
          }
        >
          Your appointments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "one_to_one"}
          onClick={() => setTab("one_to_one")}
          className={
            "rounded-md border px-3 py-1.5 text-sm " +
            (tab === "one_to_one" ? "border-teal bg-teal/10 text-navy font-medium" : "bg-card")
          }
        >
          Book one-on-one
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "groups"}
          onClick={() => setTab("groups")}
          className={
            "rounded-md border px-3 py-1.5 text-sm " +
            (tab === "groups" ? "border-teal bg-teal/10 text-navy font-medium" : "bg-card")
          }
        >
          Groups
        </button>
      </div>

      {tab === "yours" && <AppointmentsSummary patientId={currentId} />}

      {tab === "groups" && <PatientGroupScheduling patientId={currentId} />}

      {tab === "one_to_one" && (
      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">What kind of visit?</Label>
          <Select
            value={serviceType}
            onValueChange={(v) => {
              setServiceType(v as ServiceType);
              setSelectedStart("");
              setActiveDayKey("");
              setLocationId("");
              setClinicianId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a visit type" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeService && (
            <p className="text-xs text-muted-foreground pt-0.5">{activeService.helper}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">{t("schPickFormat")}</Label>
          <div
            className={
              "grid grid-cols-1 gap-2 " +
              (allowedModalities.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")
            }
          >
            {allowedModalities.includes("video") && (
              <button
                type="button"
                onClick={() => setModality("video")}
                className={
                  "flex items-center justify-center gap-2 rounded-md border p-2.5 min-h-11 text-sm transition-colors " +
                  (effectiveModality === "video"
                    ? "border-teal bg-teal/10 text-navy"
                    : "bg-card hover:border-teal/60 text-foreground/70")
                }
              >
                <Video className="h-4 w-4" /> {t("schVideo")}
              </button>
            )}
            {allowedModalities.includes("phone") && (
              <button
                type="button"
                onClick={() => setModality("phone")}
                className={
                  "flex items-center justify-center gap-2 rounded-md border p-2.5 min-h-11 text-sm transition-colors " +
                  (effectiveModality === "phone"
                    ? "border-teal bg-teal/10 text-navy"
                    : "bg-card hover:border-teal/60 text-foreground/70")
                }
              >
                <Phone className="h-4 w-4" /> {t("schPhone")}
              </button>
            )}
            {allowedModalities.includes("in_person") && (
              <button
                type="button"
                onClick={() => setModality("in_person")}
                className={
                  "flex items-center justify-center gap-2 rounded-md border p-2.5 min-h-11 text-sm transition-colors " +
                  (effectiveModality === "in_person"
                    ? "border-teal bg-teal/10 text-navy"
                    : "bg-card hover:border-teal/60 text-foreground/70")
                }
              >
                <Building2 className="h-4 w-4" /> In person
              </button>
            )}
          </div>
        </div>

        {effectiveModality === "in_person" && (
          <div className="space-y-1.5">
            <Label className="text-sm">Where would you like to meet?</Label>
            <Select
              value={locationId}
              onValueChange={(v) => {
                setLocationId(v);
                setSelectedStart("");
                setActiveDayKey("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} — {l.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeLocation && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-0.5">
                <MapPin className="h-3.5 w-3.5 text-teal mt-0.5" />
                {activeLocation.address}, {activeLocation.city}
                {activeLocation.room ? ` · ${activeLocation.room}` : ""}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm">{t("schCounselor")}</Label>
          <Select
            value={effectiveClinicianId}
            onValueChange={(v) => {
              setClinicianId(v);
              setSelectedStart("");
              setActiveDayKey("");
            }}
            disabled={clinicians.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a counselor" />
            </SelectTrigger>
            <SelectContent>
              {clinicians.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}, {c.credential}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clinicians.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-1">
              No counselors match that combination yet. Try another format or location, or contact
              your case manager.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <CalendarClock className="h-3 w-3 text-teal" /> Times come from your counselor's live
              calendar. You can only pick what's open.
            </p>
          )}
        </div>

        {dayGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-secondary/30 p-4 text-sm text-muted-foreground">
            No openings with this counselor in the next two weeks. Try another counselor above, or
            contact your case manager for help.
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-sm">Pick a day</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-px-4">
                {dayGroups.map((g) => {
                  const key = g.date.toDateString();
                  const open = g.slots.filter((s) => !s.taken).length;
                  const isActive = (activeDay?.date.toDateString() ?? "") === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setActiveDayKey(key);
                        setSelectedStart("");
                      }}
                      disabled={open === 0}
                      className={
                        "shrink-0 snap-start min-h-11 rounded-lg border px-3 py-2 text-center text-xs transition-colors " +
                        (isActive
                          ? "border-teal bg-teal/10 text-navy"
                          : open === 0
                            ? "opacity-40 cursor-not-allowed"
                            : "bg-card hover:border-teal/60")
                      }
                    >
                      <div className="font-medium">
                        {g.date.toLocaleDateString(undefined, {
                          weekday: "short",
                        })}
                      </div>
                      <div className="text-base text-navy font-display">{g.date.getDate()}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {open === 0 ? "Full" : `${open} open`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Pick a time</Label>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm border border-teal bg-teal/20" />
                  Open
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm border bg-muted" />
                  <span className="line-through">Taken</span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeDay?.slots.map((s) => {
                  const isActive = selectedStart === s.start;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => !s.taken && setSelectedStart(s.start)}
                      disabled={s.taken}
                      aria-label={
                        (s.taken ? "Taken: " : "Open: ") +
                        new Date(s.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      }
                      className={
                        "min-h-11 rounded-md border p-2 text-sm transition-colors flex flex-col items-center justify-center gap-0.5 " +
                        (isActive
                          ? "border-teal bg-teal/10 text-navy font-medium"
                          : s.taken
                            ? "opacity-60 cursor-not-allowed"
                            : "bg-card hover:border-teal/60")
                      }
                    >
                      <span className={s.taken ? "line-through" : ""}>
                        {new Date(s.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={
                          "text-[10px] " + (s.taken ? "text-muted-foreground" : "text-teal")
                        }
                      >
                        {s.taken ? "Taken" : "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="rounded-md border bg-secondary/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-teal mt-0.5" />
          <span>
            Session length is {defaultDuration} minutes. Your care team sets this — call your case
            manager if you need it changed.
          </span>
        </div>
        <Button
          className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
          onClick={submit}
          disabled={!selectedStart}
        >
          {isReschedule ? (
            <>
              <CalendarClock className="h-4 w-4 mr-1.5" /> Confirm new time
            </>
          ) : (
            <>
              <CalendarPlus className="h-4 w-4 mr-1.5" /> {t("schRequest")}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-teal mt-0.5" />
          {t("schSafety")}
        </p>
        <p
          data-testid="booking-not-reported"
          className="text-xs text-muted-foreground flex items-start gap-1.5"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-teal mt-0.5" />
          {t("schNotReported")}
        </p>
      </Card>
      )}
    </div>
  );
}
