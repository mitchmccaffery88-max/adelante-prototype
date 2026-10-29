import { CircleAlert } from "lucide-react";
// §Scheduling S1 — one "Book a visit" side drawer for every surface (+ New,
// Scheduling tile, requests queue, chart). Mounted once; opened through
// `openBookVisit()`. Booking runs through the registry (runAction) and
// bookAppointment re-checks every rule; blocked bookings show inline.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { act } from "@/lib/actions/act";
import { AdelanteEHR, useEhr, type ServiceType } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { BOOKING_RIGHTS_DRAFT_LABEL, bookingRightFor } from "@/lib/bookingRights";
import { BOOK_VISIT_EVENT, bookablePatients, bookableServiceTypes, eligibleClinicians, openSlots, precheckBooking, visitTypeLabel, type BookVisitRequest } from "@/lib/bookingFlow";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SERIES_DRAFT, type SeriesCadence } from "@/lib/fundingSource";
import { hasAvailabilitySet, NO_AVAILABILITY_FOR_TYPE, NO_AVAILABILITY_NEXT, NO_AVAILABILITY_TEXT } from "@/lib/clinicianAvailability";

type Modality = "video" | "phone" | "in_person";

export function BookVisitDrawerHost() {
  const staff = useActingStaff();
  const actor = useMemo(() => ({ staffId: staff.staffId, staffName: staff.staffName, clinicianId: staff.clinicianId, role: staff.role }), [staff.staffId, staff.staffName, staff.clinicianId, staff.role]);
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState<BookVisitRequest>({});
  const [patientId, setPatientId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("therapy_individual");
  const [modality, setModality] = useState<Modality>("in_person");
  const [clinicianId, setClinicianId] = useState("");
  const [slot, setSlot] = useState("");
  const [locationId, setLocationId] = useState("");
  const [blocked, setBlocked] = useState<{ reason: string; next: string } | null>(null);
  // 29 Oct (Mitch, Draft): staff-only recurring series for individual visits.
  const [repeat, setRepeat] = useState<"none" | SeriesCadence>("none");
  const [endBy, setEndBy] = useState<"count" | "date">("count");
  const [seriesCount, setSeriesCount] = useState("6");
  const [seriesEnd, setSeriesEnd] = useState("");
  const [seriesResult, setSeriesResult] = useState<{ booked: number; blocked: { start: string; reason: string }[] } | null>(null);

  const patients = useEhr(() => bookablePatients(actor));
  const types = useMemo(() => bookableServiceTypes(actor.role), [actor.role]);
  const patient = patients.find((p) => p.id === patientId);
  const svc = AdelanteEHR.getServiceType(serviceType);
  const suggestions = useEhr(() => eligibleClinicians(serviceType, patient, actor, modality));
  const slots = useEhr(() => (clinicianId ? openSlots(clinicianId, { serviceType, modality }).slice(0, 12) : []));
  const hasHours = useEhr(() => (clinicianId ? hasAvailabilitySet(clinicianId) : true));
  const locations = useEhr(() => AdelanteEHR.locationsForService(serviceType));

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = ((e as CustomEvent<BookVisitRequest>).detail ?? {}) as BookVisitRequest;
      setReq(d);
      setPatientId(d.patientId ?? "");
      if (d.serviceType) setServiceType(d.serviceType);
      setClinicianId("");
      setSlot("");
      setBlocked(null);
      setRepeat("none");
      setSeriesResult(null);
      setOpen(true);
    };
    window.addEventListener(BOOK_VISIT_EVENT, onOpen);
    return () => window.removeEventListener(BOOK_VISIT_EVENT, onOpen);
  }, []);

  // Default visit type: my own calendar's first service (e.g. SUD counselor → SUD counseling).
  useEffect(() => {
    if (!open || req.serviceType) return;
    const own = AdelanteEHR.listClinicians().find((c) => c.id === actor.clinicianId);
    const first = own?.services?.find((sv) => types.some((t) => t.id === sv));
    if (first) setServiceType(first);
  }, [open, req.serviceType, actor.clinicianId, types]);
  // Default to my own calendar when I have one and it fits.
  useEffect(() => {
    if (clinicianId && suggestions.some((s) => s.clinician.id === clinicianId)) return;
    setClinicianId(suggestions.find((s) => s.own)?.clinician.id ?? suggestions[0]?.clinician.id ?? "");
    setSlot("");
  }, [suggestions, clinicianId]);
  useEffect(() => {
    if (svc && !svc.allowedModalities.includes(modality)) setModality(svc.allowedModalities[0] ?? "in_person");
  }, [svc, modality]);

  const pre = precheckBooking({ actor, patient, serviceType, clinicianId, modality, asam: !!req.asamTaskId });
  const shown = blocked ?? (patient && !pre.ok ? pre : null);

  const doBook = () => {
    setBlocked(null);
    if (!pre.ok) return setBlocked(pre);
    if (!slot) return setBlocked({ reason: "Pick a time.", next: "Choose one of the open slots." });
    if (modality === "in_person" && !locationId) return setBlocked({ reason: "Pick a location for an in-person visit.", next: "Choose a clinic site, or switch to video/phone." });
    if (repeat !== "none") {
      try {
        const res = act<{ booked: unknown[]; blocked: { start: string; reason: string }[] }>("schedule_visit_series", "bookAppointmentSeries", {
          patientId, clinicianId, firstStart: slot, cadence: repeat,
          ...(endBy === "count" ? { count: Number(seriesCount) || 0 } : { endDate: seriesEnd }),
          durationMin: svc?.defaultDurationMin ?? 50, serviceType, modality,
          locationId: modality === "in_person" ? locationId : undefined,
          bookedBy: { id: actor.staffName, staffId: actor.staffId, role: actor.role },
        });
        setSeriesResult({ booked: res.booked.length, blocked: res.blocked });
        toast.success(`${res.booked.length} visit${res.booked.length === 1 ? "" : "s"} booked`, res.blocked.length ? { description: `${res.blocked.length} not booked — see the list.` } : undefined);
        if (!res.blocked.length) setOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not book that series.";
        setBlocked({ reason: msg, next: nextStepFor(msg) });
      }
      return;
    }
    try {
      act("schedule_visit", "bookAppointment", {
        patientId,
        clinicianId,
        start: slot,
        durationMin: svc?.defaultDurationMin ?? 50,
        serviceType,
        modality,
        locationId: modality === "in_person" ? locationId : undefined,
        source: "staff_scheduled",
        ...(req.requestId ? { requestId: req.requestId } : {}),
        ...(req.asamTaskId ? { asamTaskId: req.asamTaskId } : {}),
        bookedBy: { id: actor.staffName, staffId: actor.staffId, role: actor.role },
      });
      const c = suggestions.find((s) => s.clinician.id === clinicianId)?.clinician;
      toast.success("Visit booked", { description: `${c?.name ?? "Clinician"} · ${new Date(slot).toLocaleString()}` });
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not book that time.";
      setBlocked({ reason: msg, next: nextStepFor(msg) });
    }
  };

  const right = bookingRightFor(actor.role);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="book-visit-drawer">
        <SheetHeader>
          <SheetTitle>Book a visit</SheetTitle>
          <SheetDescription>
            {right.scope === "caseload" ? "For people on your caseload, with any eligible clinician." : right.scope === "any" ? "Any clinician's calendar, any patient." : "Your calendar by default — you can book a colleague for a follow-up."}
          </SheetDescription>
        </SheetHeader>
        {right.scope === "none" ? (
          <p className="mt-4 text-sm text-muted-foreground">Your role doesn't book visits.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {req.requestId && <p className="text-xs text-teal">Booking from an appointment request — booking closes it.</p>}
            {req.asamTaskId && <p className="text-xs text-teal" data-testid="booking-from-asam-task">Linked to the assessment task. Booking does not close the task.</p>}
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={(v) => { setPatientId(v); setBlocked(null); }}>
                <SelectTrigger data-testid="book-patient"><SelectValue placeholder={patients.length ? "Choose a patient" : "No one on your caseload"} /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Visit type</Label>
                <Select value={serviceType} onValueChange={(v) => { setServiceType(v as ServiceType); setBlocked(null); }}>
                  <SelectTrigger data-testid="book-service"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {types.map((s) => <SelectItem key={s.id} value={s.id}>{visitTypeLabel(s.id, actor.role)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>How</Label>
                <Select value={modality} onValueChange={(v) => { setModality(v as Modality); setBlocked(null); }}>
                  <SelectTrigger data-testid="book-modality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(svc?.allowedModalities ?? ["in_person"]).map((m) => <SelectItem key={m} value={m}>{m === "in_person" ? "In person" : m === "video" ? "Video" : "Phone"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!right.sudVisits && <p className="text-xs text-muted-foreground">Assessment and group-counseling requests go to the clinical coordinator.</p>}
            {modality === "in_person" && (
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger data-testid="book-location"><SelectValue placeholder="Choose a site" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Suggested clinicians</Label>
              {suggestions.length === 0 ? <p className="text-sm text-muted-foreground">No eligible clinician offers this visit type.</p> : (
                <div className="space-y-1" role="radiogroup" aria-label="Clinician">
                  {suggestions.map((s) => (
                    <button key={s.clinician.id} type="button" role="radio" aria-checked={clinicianId === s.clinician.id} onClick={() => { setClinicianId(s.clinician.id); setSlot(""); setBlocked(null); }} className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${clinicianId === s.clinician.id ? "border-primary bg-accent" : "border-border"}`}>
                      <span className="font-medium">{s.clinician.name}{s.own ? " (my calendar)" : ""}</span>
                      <span className={`text-xs ${clinicianId === s.clinician.id ? "text-accent-foreground/80" : "text-muted-foreground"}`}>{s.fit.join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clinicianId && (
              <div className="space-y-1.5">
                <Label>Open times</Label>
                {!hasHours ? (
                  <p className="rounded border border-dashed p-2 text-sm text-muted-foreground" data-testid="book-no-availability"><span className="font-medium text-foreground">{NO_AVAILABILITY_TEXT}.</span> {NO_AVAILABILITY_NEXT}</p>
                ) : slots.length === 0 ? (
                  <p className="rounded border border-dashed p-2 text-sm text-muted-foreground" data-testid="book-no-slots">{NO_AVAILABILITY_FOR_TYPE}. Try another visit type, how, or clinician.</p>
                ) : null}
                <div className="grid grid-cols-2 gap-1.5" data-testid="book-slots">
                  {slots.map((s) => (
                    <Button key={s} type="button" size="sm" variant={slot === s ? "default" : "outline"} onClick={() => { setSlot(s); setBlocked(null); }}>
                      {new Date(s).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {shown && (
              <div role="alert" className="rounded border-2 border-input bg-surface-sunk p-3 text-sm" data-testid="book-blocked">
                <p className="font-medium text-attention"><CircleAlert className="mr-1 inline size-4 shrink-0 align-text-bottom" aria-hidden="true" />{shown.reason}</p>
                <p className="mt-1 text-muted-foreground">What to do: {shown.next}</p>
              </div>
            )}
            {!req.asamTaskId && !/group/.test(serviceType) && (
              <div className="space-y-2 rounded border p-3" data-testid="book-series">
                <Label>Repeat</Label>
                <Select value={repeat} onValueChange={(v) => { setRepeat(v as typeof repeat); setSeriesResult(null); }}>
                  <SelectTrigger data-testid="book-repeat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Just this visit</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                    <SelectItem value="biweekly">Every two weeks</SelectItem>
                  </SelectContent>
                </Select>
                {repeat !== "none" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={endBy} onValueChange={(v) => setEndBy(v as typeof endBy)}>
                      <SelectTrigger data-testid="book-series-endby"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Number of visits</SelectItem>
                        <SelectItem value="date">End date</SelectItem>
                      </SelectContent>
                    </Select>
                    {endBy === "count" ? (
                      <Input type="number" min={1} max={SERIES_DRAFT.maxVisitsPerSeries} value={seriesCount} onChange={(e) => setSeriesCount(e.target.value)} aria-label="Number of visits" data-testid="book-series-count" />
                    ) : (
                      <Input type="date" value={seriesEnd} onChange={(e) => setSeriesEnd(e.target.value)} aria-label="End date" data-testid="book-series-end" />
                    )}
                  </div>
                )}
                {repeat !== "none" && (
                  <p className="text-xs text-muted-foreground">
                    Each visit is checked on its own date. Maximum {SERIES_DRAFT.maxVisitsPerSeries} visits per series ({SERIES_DRAFT.label}).
                  </p>
                )}
              </div>
            )}
            {seriesResult && seriesResult.blocked.length > 0 && (
              <div className="rounded border-2 border-input bg-surface-sunk p-3 text-sm" data-testid="book-series-blocked">
                <p className="font-medium">{seriesResult.booked} booked. These weren&apos;t booked — rebook them with another clinician:</p>
                <ul className="mt-1 list-disc pl-5">
                  {seriesResult.blocked.map((b) => (
                    <li key={b.start}>{new Date(b.start).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} — {b.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="w-full" onClick={doBook} data-testid="book-confirm">{repeat === "none" ? "Book visit" : "Book series"}</Button>
            <p className="text-[11px] text-muted-foreground">Booking rights: {BOOKING_RIGHTS_DRAFT_LABEL}. The clinician and the patient are notified.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function nextStepFor(msg: string): string {
  if (/consent/i.test(msg)) return "Capture telehealth consent in the chart's Consents section, or book in person.";
  if (/caseload/i.test(msg)) return "Ask a clinical coordinator to book, or to add this person to your caseload.";
  if (/conflict|already|overlap|taken/i.test(msg)) return "Pick another time.";
  if (/license|credential/i.test(msg)) return "Pick another clinician.";
  if (/Part 2|assessment|substance/i.test(msg)) return "Send the request to the clinical coordinator.";
  return "Adjust the details above, or ask a clinical coordinator.";
}
