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

  const patients = useEhr(() => bookablePatients(actor));
  const types = useMemo(() => bookableServiceTypes(actor.role), [actor.role]);
  const patient = patients.find((p) => p.id === patientId);
  const svc = AdelanteEHR.getServiceType(serviceType);
  const suggestions = useEhr(() => eligibleClinicians(serviceType, patient, actor, modality));
  const slots = useEhr(() => (clinicianId ? openSlots(clinicianId).slice(0, 12) : []));
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
      setOpen(true);
    };
    window.addEventListener(BOOK_VISIT_EVENT, onOpen);
    return () => window.removeEventListener(BOOK_VISIT_EVENT, onOpen);
  }, []);

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
                      <span className="text-xs text-muted-foreground">{s.fit.join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clinicianId && (
              <div className="space-y-1.5">
                <Label>Open times</Label>
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
              <div role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="book-blocked">
                <p className="font-medium text-destructive">{shown.reason}</p>
                <p className="mt-1 text-muted-foreground">What to do: {shown.next}</p>
              </div>
            )}
            <Button className="w-full" onClick={doBook} data-testid="book-confirm">Book visit</Button>
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
