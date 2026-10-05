import { scheduleCopy, serviceLabel, serviceHelper, SCHEDULE_ES_DRAFT } from "@/lib/scheduleCopy";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { act, actFor } from "@/lib/actions/act";
import { runAction } from "@/lib/actions/runAction";
import { patientBookableClinicians, patientPrecheck, patientSlots, PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { useEffect, useMemo, useState } from "react";
import {
  AdelanteEHR,
  APPOINTMENT_SOURCE_LABEL,
  useEhr,
  type ServiceType,
} from "@/lib/ehr";
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
  const { t, lang } = useI18n();
  const sc = scheduleCopy(lang);
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
  // §Batch G3 — same engine as staff booking: eligible clinicians, assigned first.
  const clinicianOptions = useEhr(() => patientBookableClinicians(patient, serviceType, effectiveModality));
  const clinicians = clinicianOptions.map((o) => o.clinician);
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
  // Clicking "Reschedule" from the list changes the search in place — jump to the picker.
  useEffect(() => {
    if (!rescheduleId) return;
    setTab("one_to_one");
    if (existing) {
      setServiceType(existing.serviceType ?? "");
      setClinicianId(existing.clinicianId);
      setLocationId(existing.locationId ?? "");
      if (existing.modality) setModality(existing.modality);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescheduleId]);
  const [activeDayKey, setActiveDayKey] = useState<string>("");

  const availability = useEhr(() =>
    patientSlots(effectiveClinicianId, serviceType, effectiveModality, isReschedule ? existing?.id : undefined).map((start) => ({
      start,
      durationMin: activeService?.defaultDurationMin ?? 50,
      taken: false,
    })),
  );
  const clinicianHasHours = clinicianOptions.find((o) => o.clinician.id === effectiveClinicianId)?.hasHours ?? false;
  const consentCheck = patientPrecheck(patient, effectiveModality);
  const needsConsent = !consentCheck.ok && consentCheck.reason === "telehealth_consent";

  // §Scheduling — patient-level awareness: what they already have booked.
  const upcomingAppts = useEhr(() =>
    AdelanteEHR.appointmentsForPatient(currentId)
      .filter((a) => a.status === "scheduled" && +new Date(a.start) > Date.now())
      .sort((a, b) => +new Date(a.start) - +new Date(b.start)),
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
      toast.error(sc.pickService);
      return;
    }
    if (effectiveModality === "in_person" && !locationId) {
      toast.error(sc.pickLocationErr);
      return;
    }
    if (!selectedStart || !effectiveClinicianId) {
      toast.error(sc.pickTime);
      return;
    }
    try {
      if (isReschedule && existing) {
        const rr = runAction(
          "patient_reschedule",
          { role: PATIENT_ACTOR_ROLE, staffId: patient.id, staffName: "Patient (self)" },
          patient,
          {
            args: [
              {
                patientId: patient.id,
                apptId: existing.id,
                start: selectedStart,
                serviceType: serviceType as ServiceType,
                modality: effectiveModality,
                locationId: effectiveModality === "in_person" ? locationId : undefined,
                clinicianId: effectiveClinicianId,
              },
            ],
          },
        );
        if (!rr.ok) throw new Error(rr.reason);
        toast.success(sc.rescheduled, {
          description: sc.rescheduledDesc,
        });
      } else {
        const r = runAction(
          "patient_self_book",
          { role: PATIENT_ACTOR_ROLE, staffId: patient.id, staffName: "Patient (self)" },
          patient,
          {
            args: [
              {
                patientId: patient.id,
                clinicianId: effectiveClinicianId,
                start: selectedStart,
                durationMin: defaultDuration,
                serviceType: serviceType as ServiceType,
                modality: effectiveModality,
                locationId: effectiveModality === "in_person" ? locationId : undefined,
              },
            ],
          },
        );
        if (!r.ok) throw new Error(r.reason);
        toast.success(t("schRequested"), {
          description:
            effectiveModality === "in_person" && activeLocation
              ? sc.inPersonAt(activeLocation.name)
              : t("schRequestedDesc"),
        });
      }
      // Land on the summary so the new booking is immediately visible.
      navigate({ to: "/schedule", search: { tab: "yours" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : sc.couldNotBook);
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
          {isReschedule ? sc.eyebrowReschedule : sc.eyebrowBook}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">
          {isReschedule ? sc.titleReschedule : sc.titleBook}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isReschedule
            ? sc.subReschedule
            : sc.subBook}
        </p>
        {lang === "es" && <p className="mt-1 text-[11px] text-muted-foreground" data-testid="schedule-es-draft">{SCHEDULE_ES_DRAFT}</p>}
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
          {sc.tabYours}
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
          {sc.tabOne}
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
          {sc.tabGroups}
        </button>
      </div>

      {tab === "yours" && <AppointmentsSummary patientId={currentId} />}

      {tab === "groups" && <PatientGroupScheduling patientId={currentId} />}

      {tab === "one_to_one" && !isReschedule && upcomingAppts.length > 0 && (
        <Card
          className="mb-4 border-amber-warm bg-amber-warm/10 p-4"
          data-testid="existing-appointment-notice"
        >
          <div className="flex items-start gap-2.5">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-navy">{sc.alreadyBooked}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {upcomingAppts.slice(0, 3).map((a) => {
                  const c = AdelanteEHR.getClinician(a.clinicianId);
                  return (
                    <li key={a.id}>
                      {new Date(a.start).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {c ? ` · ${c.name}` : ""}
                      {a.source ? ` · ${APPOINTMENT_SOURCE_LABEL[a.source]}` : ""}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-muted-foreground">
                {sc.overlapWarn}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => setTab("yours")}
              >
                {sc.seeAppts}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {tab === "one_to_one" && (
      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">{sc.whatKind}</Label>
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
              <SelectValue placeholder={sc.pickType} />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {serviceLabel(s.id, s.label, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeService && (
            <p className="text-xs text-muted-foreground pt-0.5">{serviceHelper(activeService.id, activeService.helper, lang)}</p>
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
                <Building2 className="h-4 w-4" /> {sc.inPerson}
              </button>
            )}
          </div>
        </div>

        {effectiveModality === "in_person" && (
          <div className="space-y-1.5">
            <Label className="text-sm">{sc.whereMeet}</Label>
            <Select
              value={locationId}
              onValueChange={(v) => {
                setLocationId(v);
                setSelectedStart("");
                setActiveDayKey("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={sc.pickLocation} />
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
              <SelectValue placeholder={sc.pickCounselor} />
            </SelectTrigger>
            <SelectContent>
              {clinicians.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}, {c.credential}
                  {c.id === patient.primaryClinicianId ? ` · ${t("schAssigned")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clinicians.length === 0 ? (
            <p className="text-xs text-muted-foreground pt-1" data-testid="sch-no-clinicians">
              {t("schNoClinicians")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <CalendarClock className="h-3 w-3 text-teal" /> {t("schRealHours")}
            </p>
          )}
        </div>

        {needsConsent && (
          <div role="alert" className="rounded-lg border border-amber-warm/60 bg-amber-warm/10 p-3 text-sm" data-testid="sch-telehealth-consent">
            {t("schNeedTelehealthConsent")}
          </div>
        )}
        {dayGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-secondary/30 p-4 text-sm text-muted-foreground" data-testid="sch-no-openings">
            {effectiveClinicianId && !clinicianHasHours ? t("schNoHours") : t("schNoOpenings")}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-sm">{sc.pickDay}</Label>
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
                        {g.date.toLocaleDateString(lang === "es" ? "es-US" : undefined, {
                          weekday: "short",
                        })}
                      </div>
                      <div className="text-base text-navy font-display">{g.date.getDate()}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {open === 0 ? sc.full : sc.nOpen(open)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{sc.pickTimeLabel}</Label>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm border border-teal bg-teal/20" />
                  {sc.open}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm border bg-muted" />
                  <span className="line-through">{sc.taken}</span>
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
                        (s.taken ? `${sc.taken}: ` : `${sc.open}: `) +
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
                        {s.taken ? sc.taken : sc.open}
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
            {sc.sessionLength(defaultDuration)}
          </span>
        </div>
        <Button
          className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
          onClick={submit}
          disabled={!selectedStart}
        >
          {isReschedule ? (
            <>
              <CalendarClock className="h-4 w-4 mr-1.5" /> {sc.confirmNew}
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
