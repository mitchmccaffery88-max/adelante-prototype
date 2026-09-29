import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { coverageStatusLabel, verifiedLabel } from "@/lib/coverageStatus";
import { coverageKind } from "@/lib/billingLane";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { bucketWorkspaceVisits, resolveWorkspaceActor, viewAsOptions, type WorkspaceActor } from "@/lib/workspaceIdentity";
import { inFacilityEnabled, isInFacilityTask } from "@/lib/inFacility";
import { AdelanteEHR, useEhr, type SessionStatus, VISIT_STATUS_LABEL, isSudMedicationName, APPT_REQUEST_BOOK_AS } from "@/lib/ehr";
import { refillNeedsCures } from "@/lib/ehr";
import { RefillCuresStep } from "@/components/clinical/RefillCuresStep";
import { AppointmentRequestsCard } from "@/components/scheduling/AppointmentRequestsCard";
import { roleWorksAsamTask } from "@/components/clinical/AsamTaskWorkItem";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Video,
  Calendar as CalIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  FileText,
  TrendingUp,
  CalendarPlus,
  TrendingDown,
  Minus,
  CalendarClock,
  AlertTriangle,
  UserCog,
  Lock,
  FlaskConical,
  UserCheck,
  Users,
} from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { StaffPatientSearch } from "@/components/StaffPatientSearch";
import { useI18n } from "@/lib/i18n";
import { CarePlanCard } from "@/components/CarePlanCard";
import { roleSeesAsam, roleSeesSudMedication, SUD_MED_WITHHELD_ROLES, SUD_MED_ACCESS_NOTE } from "@/lib/asamReporting";
import { useActingRole, useActingStaff, canAccess, getStaffMember } from "@/lib/roles";
import {
  assignmentIdentityFor,
  hasAssignmentIdentity,
  isAssignedTo,
  scopeCaseload,
  CASELOAD_SCOPE_NOTE,
} from "@/lib/caseloadScope";
import { TaskQueueCard, type TaskQueueSource } from "@/components/tasks/TaskQueueCard";
import { myOpenItems } from "@/lib/myWork";
import { SupervisionBanner } from "@/components/clinical/SupervisionBanner";
import { ClientRecordDrawer } from "@/components/ClientRecordDrawer";
import { confirmDiscardDrawerEdits } from "@/lib/drawer-drafts";
import { listUnsignedWork } from "@/lib/unsignedWork";
import { WorkspaceDashboard } from "@/components/clinician/WorkspaceDashboard";
import { DashboardActionLauncher } from "@/components/clinician/DashboardActionLauncher";


export const Route = createFileRoute("/clinician")({
  // §ASAM visit — "Schedule assessment visit" on the ASAM task opens this
  // booking flow prefilled (intake type) and linked to the task.
  validateSearch: (s: Record<string, unknown>): { asamTask?: string } =>
    typeof s.asamTask === "string" ? { asamTask: s.asamTask } : {},
  head: () => ({
    meta: [
      { title: "Clinician Scheduler — Adelante" },
      { name: "description", content: "Caseload, scheduler, video sessions, and billing status." },
      { property: "og:title", content: "Clinician Workspace — Adelante" },
      {
        property: "og:description",
        content: "Clinical schedule, action queues, patient charts, and appointment management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicianPage,
});

const statusBadge: Record<SessionStatus, string> = {
  scheduled: "bg-teal/15 text-teal",
  checked_in: "bg-gold/30 text-navy",
  attended: "bg-success/20 text-success",
  no_show: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  late_cancel: "bg-muted text-muted-foreground",
  rescheduled: "bg-muted text-muted-foreground",
};

// The ONE person every widget on this page reads (acting person, or "View as").
const WorkspaceActorContext = createContext<WorkspaceActor | null>(null);
function useWorkspaceActor(): WorkspaceActor {
  const acting = useActingStaff();
  return useContext(WorkspaceActorContext) ?? acting;
}

function ClinicianPage() {
  const { t } = useI18n();
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  // Identity — always the acting person from the top-bar switcher, unless a
  // coordinator / sys_admin / supervisor explicitly picks "View as".
  const acting = useActingStaff();
  const [viewAsId, setViewAsId] = useState<string>("");
  const viewOptions = viewAsOptions(acting);
  const ws = resolveWorkspaceActor(acting, viewAsId || undefined);
  useEffect(() => {
    setViewAsId("");
  }, [acting.staffId]);
  useEffect(() => {
    if (!ws.viewingAs) return;
    AdelanteEHR.recordWorkspaceViewAs({ id: acting.staffId, name: acting.staffName, role: acting.role }, { id: ws.staffId, name: ws.staffName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.viewingAs, ws.staffId]);
  const clinicianId = ws.clinicianId ?? "";
  const clinician = clinicians.find((c) => c.id === clinicianId);
  const appts = useEhr(() =>
    clinicianId ? AdelanteEHR.appointmentsForClinician(clinicianId) : [],
  );

  const serviceTypes = useEhr(() => AdelanteEHR.listServiceTypes());
  const [book, setBook] = useState<{
    patientId: string;
    start: string;
    durationMin: number;
    serviceType: import("@/lib/ehr").ServiceType;
    modality: "video" | "phone" | "in_person";
    locationId: string;
  }>({
    patientId: patients[0]?.id ?? "",
    start: "",
    durationMin: 50,
    serviceType: "therapy_individual",
    modality: "video",
    locationId: "",
  });
  const [bookRole] = useActingRole();
  const bookActor = useActingStaff();
  const [bookRequestId, setBookRequestId] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const { asamTask: asamTaskParam } = Route.useSearch();
  const asamTask = useEhr(() =>
    asamTaskParam ? AdelanteEHR.listCaseTasks().find((t) => t.id === asamTaskParam && t.status !== "done") : undefined,
  );
  const asamTaskPatient = useEhr(() => (asamTask ? AdelanteEHR.getPatient(asamTask.patientId) : undefined));
  // Only roles passing the ASAM Part 2 check may book against the task.
  const bookAsamTaskId = asamTask && roleWorksAsamTask(bookRole, asamTaskPatient) ? asamTask.id : undefined;
  useEffect(() => {
    if (!bookAsamTaskId || !asamTask) return;
    const svc = serviceTypes.find((x) => x.id === "intake");
    setBook((b) => ({
      ...b,
      patientId: asamTask.patientId,
      serviceType: "intake",
      durationMin: svc?.defaultDurationMin ?? b.durationMin,
      modality: svc && !svc.allowedModalities.includes(b.modality) ? (svc.allowedModalities[0] ?? "video") : b.modality,
      locationId: "",
    }));
    setBookRequestId(undefined);
    document.getElementById("book-session")?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookAsamTaskId]);
  const bookService = serviceTypes.find((s) => s.id === book.serviceType);
  const bookConflict = useEhr(() =>
    book.start && clinicianId
      ? AdelanteEHR.findApptConflict(clinicianId, new Date(book.start).toISOString())
      : undefined,
  );
  const bookConflictPatient = bookConflict && patients.find((p) => p.id === bookConflict.patientId);
  const bookLocations = useEhr(() => AdelanteEHR.locationsForService(book.serviceType));
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const selectedPatient = useEhr(() => AdelanteEHR.getPatient(selectedPatientId));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<string | undefined>(undefined);

  const doBook = () => {
    if (!book.patientId || !book.start) {
      toast.error("Pick a patient and a time");
      return;
    }
    try {
      AdelanteEHR.bookAppointment({
        patientId: book.patientId,
        clinicianId,
        start: new Date(book.start).toISOString(),
        durationMin: book.durationMin,
        serviceType: book.serviceType,
        modality: book.modality,
        locationId: book.modality === "in_person" ? book.locationId : undefined,
        source: "staff_scheduled",
        ...(bookRequestId ? { requestId: bookRequestId } : {}),
        ...(bookAsamTaskId && book.patientId === asamTask?.patientId ? { asamTaskId: bookAsamTaskId } : {}),
        bookedBy: { id: bookActor.staffName, role: bookRole },
      });
      setBookRequestId(undefined);
      if (bookAsamTaskId) navigate({ to: "/clinician", search: {} });
      toast.success("Appointment booked", { description: "Synced to provider calendar (mock)" });
      setBook({ ...book, start: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book that time.");
    }
  };

  const launch = (id: string) => {
    const session = AdelanteEHR.markTelehealthJoin(id, "clinician");
    if (!session) {
      toast.error("Could not open that session.");
      return;
    }
    if (typeof window !== "undefined") {
      window.open(session.joinUrlClinician, "_blank", "noopener,noreferrer");
    }
    toast.success("Launching telehealth session", {
      description: `Secure video · session ${session.roomId}`,
    });
  };
  const endSession = (id: string) => {
    const s = AdelanteEHR.endTelehealthSession(id, "clinician_ended");
    if (s)
      toast.success("Session ended", {
        description: `${Math.round((s.durationSec ?? 0) / 60)} min logged`,
      });
  };

  // Today = local midnight to midnight. Past visits still open → Needs closing.
  const buckets = bucketWorkspaceVisits(appts, (a) => {
    if ((patients.find((p) => p.id === a.patientId)?.progressNotes ?? []).some((n) => n.appointmentId === a.id)) return true;
    // A claim past "documented" means the visit was already written up.
    const c = AdelanteEHRExt.claimForEncounter(a.id);
    return !!c && c.state !== "documented";
  });
  const todayAppts = buckets.today;
  const closingAppts = buckets.needsClosing;
  const weekAppts = buckets.week;
  const laterAppts = buckets.later;

  // §Workspace restructure — two explicit modes. "dashboard" is the daily
  // operational view (schedule + queue counts + clinical alerts); "chart" is a
  // single patient's record. Patient-specific context only renders in chart
  // mode so the dashboard never mixes provider and patient identity.
  const [mode, setMode] = useState<"dashboard" | "chart">("dashboard");
  const openChart = (patientId: string) => {
    if (patientId !== selectedPatientId && !confirmDiscardDrawerEdits()) return;
    setSelectedPatientId(patientId);
    setMode("chart");
  };

  // §Dashboard Cleanup Phase 6a — tasks are assigned to a case manager. A
  // clinician with no case-manager identity sees their patients' open
  // follow-ups instead, labelled as exactly that.
  const actingStaff = ws;
  const assignmentIdentity = assignmentIdentityFor(actingStaff);
  const taskSource: TaskQueueSource = actingStaff.caseManagerId
    ? { kind: "case_manager", cmId: actingStaff.caseManagerId }
    : actingStaff.clinicianId
      ? {
          kind: "clinician_patients",
          patientIds: scopeCaseload(patients, assignmentIdentity, "mine").map((p) => p.id),
        }
      : { kind: "none" };


  const requestsAndBooking = (
    <div className="space-y-3">
<AppointmentRequestsCard
  onBook={(pid, kind, requestId) => {
    const svc = serviceTypes.find((x) => x.id === APPT_REQUEST_BOOK_AS[kind]);
    setBook({
      ...book,
      patientId: pid,
      serviceType: APPT_REQUEST_BOOK_AS[kind],
      durationMin: svc?.defaultDurationMin ?? book.durationMin,
      modality: svc && !svc.allowedModalities.includes(book.modality) ? (svc.allowedModalities[0] ?? "video") : book.modality,
      locationId: "",
    });
    setBookRequestId(requestId);
    document.getElementById("book-session")?.scrollIntoView({ behavior: "smooth" });
  }}
/>
<Card className="p-5" id="book-session">
  <h3 className="font-display text-lg text-navy">{t("clinBookSession")}</h3>
  {bookAsamTaskId && book.patientId === asamTask?.patientId && (
    <p className="mt-1 text-xs text-teal" data-testid="booking-from-asam-task">
      Scheduling the assessment visit for {asamTaskPatient?.firstName}'s ASAM task — linked to the task.
      Booking does not close the task; signing the ASAM does.
    </p>
  )}
  {bookRequestId && (
    <p className="mt-1 text-xs text-teal" data-testid="booking-from-request">
      Booking from an appointment request — booking closes it.
    </p>
  )}
  <div className="mt-4 space-y-3">
    <div className="space-y-1.5">
      <Label className="text-sm">{t("clinPatient")}</Label>
      <Select
        value={book.patientId}
        onValueChange={(v) => setBook({ ...book, patientId: v })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {patients.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.firstName} {p.lastName} (day {p.episodeDay}/90)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1.5">
      <Label className="text-sm">{t("clinDate")}</Label>
      <Input
        type="datetime-local"
        value={book.start}
        onChange={(e) => setBook({ ...book, start: e.target.value })}
      />
      {bookConflict && (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Conflict: you already have a session with{" "}
            {bookConflictPatient
              ? `${bookConflictPatient.firstName} ${bookConflictPatient.lastName}`
              : "another patient"}{" "}
            at this time. Pick a different time.
          </span>
        </div>
      )}
    </div>
    <div className="space-y-1.5">
      <Label className="text-sm">Service type</Label>
      <Select
        value={book.serviceType}
        onValueChange={(v) => {
          const svc = serviceTypes.find((s) => s.id === v);
          setBook({
            ...book,
            serviceType: v as import("@/lib/ehr").ServiceType,
            durationMin: svc?.defaultDurationMin ?? book.durationMin,
            modality:
              svc && !svc.allowedModalities.includes(book.modality)
                ? (svc.allowedModalities[0] ?? "video")
                : book.modality,
            locationId: "",
          });
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {serviceTypes.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1.5">
      <Label className="text-sm">Format</Label>
      <Select
        value={book.modality}
        onValueChange={(v) =>
          setBook({
            ...book,
            modality: v as "video" | "phone" | "in_person",
            locationId: v === "in_person" ? book.locationId : "",
          })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(bookService?.allowedModalities ?? ["video", "phone", "in_person"]).map(
            (m) => (
              <SelectItem key={m} value={m}>
                {m === "video" ? "Video" : m === "phone" ? "Phone" : "In person"}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    </div>
    {book.modality === "in_person" && (
      <div className="space-y-1.5">
        <Label className="text-sm">Location</Label>
        <Select
          value={book.locationId}
          onValueChange={(v) => setBook({ ...book, locationId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a location" />
          </SelectTrigger>
          <SelectContent>
            {bookLocations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name} — {l.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}
    <div className="space-y-1.5">
      <Label className="text-sm">{t("clinDuration")}</Label>
      <Select
        value={String(book.durationMin)}
        onValueChange={(v) => setBook({ ...book, durationMin: Number(v) })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="30">30 min</SelectItem>
          <SelectItem value="50">50 min</SelectItem>
          <SelectItem value="60">60 min</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <Button
      className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
      onClick={doBook}
      disabled={Boolean(bookConflict)}
    >
      {t("clinBook")}
    </Button>
  </div>
</Card>
    </div>
  );

  return (
    <WorkspaceActorContext.Provider value={ws}>
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {ws.viewingAs && (
        <div role="status" data-testid="view-as-banner" className="mb-4 rounded-md border border-gold/50 bg-gold/15 p-3 text-sm text-navy">
          Viewing {ws.staffName}'s workspace — actions are recorded as you ({acting.staffName}).
        </div>
      )}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            {t("navClinician")}
          </div>
          <h1 className="font-display text-3xl text-navy mt-1">{t("clinTitle")}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="workspace-identity">
              <ShieldCheck className="h-4 w-4 text-teal" aria-hidden="true" />
              <span>
                {ws.viewingAs ? "Viewing workspace — " : "Your workspace — "}
                <span className="font-medium text-navy">
                  {clinician ? `${clinician.name}, ${clinician.credential}` : ws.staffName}
                </span>
              </span>
          {clinician && (<>
              {/* Provider-side enrollment (NOT patient coverage — patient
                  coverage lives on the chart header in chart mode). */}
              <Badge
                className={
                  clinician.mediCalStatus === "active"
                    ? "bg-success/20 text-success border-0"
                    : clinician.mediCalStatus === "pending"
                      ? "bg-gold/30 text-navy border-0"
                      : "bg-destructive/15 text-destructive border-0"
                }
              >
                Medi-Cal enrollment: {clinician.mediCalStatus}
              </Badge>
            </>)}
          </div>
        </div>
        {viewOptions.length > 0 && (
          <Select value={viewAsId || "__self"} onValueChange={(v) => setViewAsId(v === "__self" ? "" : v)}>
            <SelectTrigger className="w-[280px]" aria-label="View as clinician">
              <SelectValue placeholder="View as…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__self">My own workspace</SelectItem>
              {viewOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  View as {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "dashboard" | "chart")} className="w-full">
        {/* §Mode toggle — pinned directly under the page header, above all
            content, so it is never below the fold. */}
        <div className="sticky top-[64px] z-20 -mx-4 mb-4 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="dashboard" className="whitespace-nowrap">
              <CalIcon className="h-4 w-4 mr-1.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="chart" className="whitespace-nowrap">
              <FileText className="h-4 w-4 mr-1.5" /> Patient chart
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard">
          <SupervisionBanner />
          {clinician?.licenseExpiresOn &&
            (() => {
              const daysUntil = Math.ceil((+new Date(clinician.licenseExpiresOn) - Date.now()) / 86400000);
              if (daysUntil > 30) return null;
              return (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-navy">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{daysUntil < 0 ? "License expired — booking is blocked" : `License expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}</span>
                </div>
              );
            })()}
          <WorkspaceDashboard
            actor={ws}
            appointments={appts}
            needsClosing={closingAppts}
            weekAppointments={weekAppts}
            patients={patients}
            launch={launch}
            openChart={openChart}
            requestsAndBooking={requestsAndBooking}
          />
          <DashboardActionLauncher
            todayPatientIds={todayAppts.map((a) => a.patientId)}
            onBook={(patientId) => {
              if (patientId) setBook((b) => ({ ...b, patientId }));
              document.getElementById("book-session")?.scrollIntoView({ behavior: "smooth" });
            }}
            onOpenChart={(patientId, section) => {
              openChart(patientId);
              if (section) { setDrawerTab(section); setDrawerOpen(true); }
            }}
          />
        </TabsContent>

        <TabsContent value="chart">
          {/* §Chart mode — patient identity, coverage, and identifiers live
              here only. */}
          <ChartHeader
            patient={selectedPatient}
            onBack={() => setMode("dashboard")}
            picker={
              <PatientPicker
                onChange={(id) => {
                  if (id === selectedPatientId) return;
                  if (!confirmDiscardDrawerEdits()) return;
                  setSelectedPatientId(id);
                }}
              />
            }
          />
          {selectedPatient && (
            <div className="mt-4 space-y-4">
              <CarePlanCard patientId={selectedPatient.id} audience="clinician" />
              <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm text-navy">Full patient record</h3>
                  <p className="text-xs text-muted-foreground">
                    Open the chart to review Problems, Allergies, Alerts, Care plan, Notes,
                    Tracking, SDOH, and more — with role-based access enforced.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDrawerTab("sdoh");
                      setDrawerOpen(true);
                    }}
                  >
                    Social context (SDOH)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDrawerTab("care-plan");
                      setDrawerOpen(true);
                    }}
                  >
                    Care plan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDrawerTab("notes");
                      setDrawerOpen(true);
                    }}
                  >
                    Notes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDrawerTab("tracking");
                      setDrawerOpen(true);
                    }}
                  >
                    Tracking
                  </Button>
                  {/* Clinicians go straight to the full chart — deeper work
                      than the caseload quick peek. */}
                  <Button size="sm" asChild className="bg-navy text-navy-foreground hover:bg-navy/90">
                    <Link
                      to="/record/$patientId"
                      params={{ patientId: selectedPatientId! }}
                      search={{}}
                    >
                      Open patient record
                    </Link>
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <ClientRecordDrawer
        patientId={selectedPatientId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialTab={drawerTab}
      />
    </div>
    </WorkspaceActorContext.Provider>
  );
}

/**
 * §Queue counts — one compact, scannable row of live counts. Each badge links
 * to the real queue page; the left sidebar stays the canonical navigation, this
 * is the "what needs me right now" signal.
 */
function QueueCountRow() {
  const crisis = useEhr(
    () =>
      AdelanteEHR.listOpenCrisisEscalations().length +
      AdelanteEHR.listAnonymousCrisisAlerts().length,
  );
  const cosign = useEhr(() => AdelanteEHR.listNotesAwaitingCosign().length);
  const messages = useEhr(() => AdelanteEHR.listUnreadMessageThreads().length);
  const refills = useEhr(() => AdelanteEHR.listRefillRequests({ status: "pending" }).length);
  const refusals = useEhr(() => (inFacilityEnabled() ? AdelanteEHR.listPendingRefusalForms({}).length : 0));
  const worklist = useEhr(
    () =>
      AdelanteEHR.listCaseTasks().filter(
        (t) => t.status === "open" && (inFacilityEnabled() || !isInFacilityTask(t)),
      ).length,
  );
  // §Tier 3 — personal rollup count, scoped to the workspace person.
  const actor = useWorkspaceActor();
  const canSeeRefusals = inFacilityEnabled() && canAccess(actor.role, "meds_erx").level !== "none";
  // §EHR audit Phase 1a — identical derivation and scope to the Inbox tab this
  // tile links to, so the two can never disagree.
  const unsigned = useEhr(
    () => listUnsignedWork({ authorId: actor.clinicianId ?? actor.staffId }).length,
  );

  const mine = useEhr(
    () =>
      myOpenItems({
        staffId: actor.staffId,
        staffName: actor.staffName,
        ...(actor.clinicianId ? { clinicianId: actor.clinicianId } : {}),
      }).total,
  );

  const items = [
    { id: "my-work", label: "My work", count: mine, to: "/my-work" as const },
    { id: "crisis", label: "Crisis", count: crisis, to: "/crisis-queue" as const, urgent: true },
    { id: "unsigned", label: "Unsigned notes", count: unsigned, to: "/inbox" as const },
    { id: "cosign", label: "Cosign inbox", count: cosign, to: "/cosign-inbox" as const },
    { id: "messages", label: "Messages", count: messages, to: "/message-queue" as const },
    { id: "worklist", label: "Worklist", count: worklist, to: "/worklist" as const },
    ...(canSeeRefusals && refusals > 0
      ? [{ id: "refusals", label: "Refusal documents", count: refusals, to: "/refusal-queue" as const }]
      : []),
  ];

  return (
    <div
      aria-label="Queue counts"
      className="mb-5 flex flex-wrap items-center gap-2"
      data-testid="clinician-queue-counts"
    >
      {items.map((i) => {
        const hot = i.urgent && i.count > 0;
        return (
          <Link
            key={i.id}
            to={i.to}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (hot
                ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15"
                : "bg-card text-foreground/80 hover:bg-secondary")
            }
          >
            {i.label}
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums " +
                (hot
                  ? "bg-destructive text-destructive-foreground"
                  : i.count > 0
                    ? "bg-navy text-navy-foreground"
                    : "bg-muted text-muted-foreground")
              }
            >
              {i.count}
            </span>
          </Link>
        );
      })}
      <a
        href="#refill-requests"
        className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
      >
        Refill requests
        <span
          className={
            "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums " +
            (refills > 0 ? "bg-navy text-navy-foreground" : "bg-muted text-muted-foreground")
          }
        >
          {refills}
        </span>
      </a>
      {inFacilityEnabled() && (
        <Link
          to="/shift-count"
          className="inline-flex items-center rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
        >
          Controlled shift count
        </Link>
      )}
    </div>
  );
}

/** Patient identity band — chart mode only. */
function ChartHeader({
  patient,
  picker,
  onBack,
}: {
  patient: ReturnType<typeof AdelanteEHR.getPatient>;
  picker: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {patient ? (
            <>
              <div className="font-display text-xl text-navy">
                {patient.firstName} {patient.lastName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>DOB {patient.dob}</span>
                <span aria-hidden="true">·</span>
                <span>ID {patient.id}</span>
                <span aria-hidden="true">·</span>
                <span>Day {patient.episodeDay}/90</span>
                {patient.coverage && (
                  <Badge
                    className={
                      patient.coverage.status === "active"
                        ? "bg-success/20 text-success border-0"
                        : "bg-gold/30 text-navy border-0"
                    }
                  >
                    {coverageKind(patient) === "medi_cal"
                      ? "Medi-Cal"
                      : coverageKind(patient) === "unknown"
                        ? "Coverage type unknown"
                        : "Coverage"}
                    : {coverageStatusLabel(patient.coverage)} ({verifiedLabel(patient.coverage.verified)})
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Pick a patient to open their chart.</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {picker}
          <Button size="sm" variant="ghost" onClick={onBack}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </Card>
  );
}


/**
 * §Phase 5b — the chart tab uses the SAME lookup component as the shared staff
 * top bar, so the app has one patient-search pattern. Inline mode selects into
 * this tab instead of navigating away; the tab still opens blank (Phase 5a).
 */
function PatientPicker({ onChange }: { onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">Patient</Label>
      <StaffPatientSearch
        variant="inline"
        placeholder="Search name, DOB, program ID, CIN"
        onSelect={onChange}
      />
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-xs font-medium uppercase tracking-wider text-teal">{label}</span>
      <span className="text-xs text-muted-foreground">· {count}</span>
    </div>
  );
}

function ApptCard({
  a,
  patients,
  launch,
  t,
  endSession,
  onOpenChart,
}: {
  a: ReturnType<typeof AdelanteEHR.appointmentsForClinician>[number];
  patients: ReturnType<typeof AdelanteEHR.listPatients>;
  launch: (id: string) => void;
  t: (k: never) => string;
  endSession: (id: string) => void;
  onOpenChart?: (patientId: string) => void;
}) {
  const p = patients.find((x) => x.id === a.patientId);
  const isFuture = new Date(a.start).getTime() > Date.now();
  const noShowActor = useActingStaff();
  const sameDay = new Date(a.start).toDateString() === new Date().toDateString();
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-navy/10 text-navy grid place-items-center">
            <CalIcon className="h-5 w-5" />
          </div>
          <div>
            {onOpenChart && p ? (
              <button
                type="button"
                onClick={() => onOpenChart(p.id)}
                className="font-medium text-navy underline-offset-2 hover:underline"
              >
                {p.firstName} {p.lastName}
              </button>
            ) : (
              <div className="font-medium text-navy">
                {p?.firstName} {p?.lastName}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <ClientDate value={a.start} /> · {a.durationMin} min
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {a.modality === "phone"
                ? "Phone"
                : a.modality === "in_person"
                  ? "In person"
                  : "Video"}
              {a.serviceType && ` · ${AdelanteEHR.getServiceType(a.serviceType)?.label ?? ""}`}
              {a.modality === "in_person" &&
                a.locationId &&
                ` · ${AdelanteEHR.getLocation(a.locationId)?.name ?? "Location"}`}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className={`${statusBadge[a.status]} border-0 capitalize`}>
                {VISIT_STATUS_LABEL[a.status]}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {(t as (k: string) => string)("clinBillingPrefix")}:{" "}
                {(() => {
                  const c = AdelanteEHRExt.claimForEncounter(a.id);
                  return c ? c.state.replace("_", " ") : "no claim";
                })()}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* §Agentic Roadmap prototype — demo entry points off a real
              appointment. Pre-visit review + live scribe before the visit,
              post-encounter dictation once it is done. Prototype only. */}
          {p && isFuture && a.status === "scheduled" && (
            <>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-11 flex-1 sm:flex-none min-w-[44px]"
              >
                <Link to="/agentic/chart-review/$patientId" params={{ patientId: p.id }}>
                  <FlaskConical className="h-4 w-4 mr-1.5" /> Pre-visit review
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-11 flex-1 sm:flex-none min-w-[44px]"
              >
                <Link to="/agentic/scribe/$patientId" params={{ patientId: p.id }}>
                  <FlaskConical className="h-4 w-4 mr-1.5" /> Scribe copilot
                </Link>
              </Button>
            </>
          )}
          {p && a.status === "attended" && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-11 flex-1 sm:flex-none min-w-[44px]"
            >
              <Link to="/agentic/dictation/$patientId" params={{ patientId: p.id }}>
                <FlaskConical className="h-4 w-4 mr-1.5" /> Smart dictation
              </Link>
            </Button>
          )}
          {isFuture && a.status === "scheduled" && (

            <>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-11 flex-1 sm:flex-none min-w-[44px]"
              >
                <Link to="/schedule" search={{ reschedule: a.id }}>
                  <CalendarClock className="h-4 w-4 mr-1.5" /> Reschedule
                </Link>
              </Button>
              <Button
                size="sm"
                className="h-11 flex-1 sm:flex-none min-w-[44px] bg-teal text-teal-foreground hover:bg-teal/90"
                onClick={() => launch(a.id)}
              >
                <Video className="h-4 w-4 mr-1.5" /> {(t as (k: string) => string)("clinJoin")}
              </Button>
              {(() => {
                const s = AdelanteEHR.getTelehealthSession(a.id);
                if (!s || s.state === "ended" || s.state === "expired") return null;
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11 flex-1 sm:flex-none min-w-[44px]"
                    onClick={() => endSession(a.id)}
                  >
                    End session
                  </Button>
                );
              })()}
            </>
          )}
          {a.status === "scheduled" && sameDay && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 flex-1 sm:flex-none min-w-[44px]"
              onClick={() => {
                try {
                  AdelanteEHR.checkInAppointment(a.id, { name: noShowActor.staffName, role: noShowActor.role, id: noShowActor.staffId });
                  toast.success("Checked in");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <UserCheck className="h-4 w-4 mr-1.5" /> Check in
            </Button>
          )}
          {((a.status === "scheduled" && !isFuture) || a.status === "checked_in") && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-11 flex-1 sm:flex-none min-w-[44px]"
                onClick={() => {
                  try {
                    AdelanteEHR.markAppointmentAttended(a.id, { name: noShowActor.staffName, role: noShowActor.role, id: noShowActor.staffId });
                    toast.success("Marked attended");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />{" "}
                {(t as (k: string) => string)("clinAttended")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 flex-1 sm:flex-none min-w-[44px]"
                onClick={() => {
                  try {
                    AdelanteEHR.markAppointmentNoShow(a.id, { name: noShowActor.staffName, role: noShowActor.role, id: noShowActor.staffId });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <XCircle className="h-4 w-4 mr-1.5" /> {(t as (k: string) => string)("clinNoShow")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function RescreenDuePanel({
  patients,
}: {
  patients: { id: string; firstName: string; lastName: string }[];
}) {
  // (component continues below)
  const { t } = useI18n();
  const rows = patients.flatMap((p) =>
    AdelanteEHR.rescreensDue(p.id).map((d) => ({ ...d, patient: p })),
  );
  if (rows.length === 0) return null;
  return (
    <Card className="p-4 bg-gold/10 border-gold/40">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-navy">
        <CalendarPlus className="h-4 w-4" /> {t("clinRescreensDue")}
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r, i) => {
          // Compute trend: latest score vs second-latest for this screener.
          const fullPatient = AdelanteEHR.getPatient(r.patient.id);
          const hist = (fullPatient?.screenerHistory ?? [])
            .filter((h) => h.key === r.key)
            .sort((a, b) => +new Date(a.completedAt) - +new Date(b.completedAt));
          const latest = hist[hist.length - 1];
          const prev = hist[hist.length - 2];
          let TrendIcon: typeof TrendingUp | null = null;
          let trendCls = "";
          if (latest && prev) {
            if (latest.score < prev.score) {
              TrendIcon = TrendingDown;
              trendCls = "text-success";
            } else if (latest.score > prev.score) {
              TrendIcon = TrendingUp;
              trendCls = "text-destructive";
            } else {
              TrendIcon = Minus;
              trendCls = "text-muted-foreground";
            }
          }
          return (
            <li
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-navy">
                  {r.patient.firstName} {r.patient.lastName}
                </span>
                · {r.key.toUpperCase()}
                {latest && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    · {latest.score}
                    {TrendIcon && <TrendIcon className={`h-3 w-3 ${trendCls}`} />}
                    {prev && <span>vs {prev.score}</span>}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">(day {r.nextDue} due)</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-8 w-full sm:w-auto"
                onClick={() => {
                  AdelanteEHR.sendRescreenTask(r.patient.id, r.key);
                  toast.success("Re-screen task sent", {
                    description: "Patient will see it on their home screen.",
                  });
                }}
              >
                {t("clinSendRescreen")}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RefillReviewCard() {
  return <RefillReviewCardInner />;
}

/**
 * Passive notification banner. Acknowledge/dismiss actions live in the
 * patient record drawer's Providers tab (single source of truth); this only
 * surfaces that something needs attention and links there.
 */
function ProviderSwitchAlerts({
  clinicianId,
  onOpen,
}: {
  clinicianId: string;
  onOpen: (patientId: string) => void;
}) {
  const outgoing = useEhr(() =>
    clinicianId
      ? AdelanteEHR.listProviderSwitches({
          clinicianId,
          role: "outgoing",
          status: "pending_review",
        })
      : [],
  );
  const patients = AdelanteEHR.listPatients();
  const clinicians = AdelanteEHR.listClinicians();
  if (!clinicianId || outgoing.length === 0) return null;
  const reasonLabel: Record<string, string> = {
    reschedule: "Rescheduled to another provider",
    new_appointment: "Booked with a new provider",
    refill_review: "Refill reviewed elsewhere",
    primary_reassignment: "Primary provider reassigned",
  };
  return (
    <Card className="p-5 border-warning/60 bg-warning/5">
      <h3 className="font-display text-base text-navy flex items-center gap-2">
        <UserCog className="h-4 w-4 text-warning" aria-hidden="true" />
        Provider switch alerts
        <Badge variant="outline" className="ml-1 text-[10px]">
          {outgoing.length}
        </Badge>
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Clients on your caseload who moved to another provider. Open the patient record to verify
        network status, coordinate hand-off, and acknowledge or dismiss the alert.
      </p>
      <ul className="mt-3 space-y-2">
        {outgoing.map((s) => {
          const p = patients.find((x) => x.id === s.patientId);
          const to = clinicians.find((c) => c.id === s.toClinicianId);
          return (
            <li key={s.id} className="rounded border bg-background p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-navy">
                    {p ? `${p.firstName} ${p.lastName}` : s.patientId}
                  </div>
                  <div className="text-muted-foreground">
                    {reasonLabel[s.reason] ?? s.reason} → {to?.name ?? s.toClinicianId}
                    {s.serviceType ? ` · ${s.serviceType}` : ""}
                  </div>
                  {s.context ? <div className="mt-1 text-muted-foreground">{s.context}</div> : null}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    <ClientDate value={s.createdAt} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => onOpen(s.patientId)}
                  >
                    Review in record
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// §Dashboard Cleanup Phase 6a — refill review, attributed and scoped.
//
// THREE REAL FIXES:
//  1. `reviewRefill` is now called WITH the acting staff member's id, so
//     `reviewedBy` is recorded and the provider-switch detection already built
//     into `reviewRefill` can fire from this surface like everywhere else.
//     Attribution follows the ACTING STAFF, never the clinician chosen in the
//     page's schedule picker — that dropdown picks whose day you're looking
//     at, not who you are.
//  2. The list defaults to refills for patients assigned to the acting
//     clinician (`isAssignedTo`, the same rule the caseload uses). A refill
//     row carries no clinician of its own, so patient assignment is the only
//     honest meaning of "mine". The toggle keeps the whole pending list one
//     click away for coverage — a default view, not a boundary.
//  3. Dose/frequency come off the live medication record, requested-by off the
//     real field, and recently reviewed refills are shown with their reviewer.
function refillReviewerLabel(
  reviewedBy: string | undefined,
  clinicians: { id: string; name: string }[],
): string {
  if (!reviewedBy) return "Reviewer not recorded";
  const c = clinicians.find((x) => x.id === reviewedBy);
  if (c) return c.name;
  return getStaffMember(reviewedBy)?.name ?? reviewedBy;
}

function RefillReviewCardInner() {
  const allPending = useEhr(() => AdelanteEHR.listRefillRequests({ status: "pending" }));
  const allRefills = useEhr(() => AdelanteEHR.listRefillRequests());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const [role] = useActingRole();
  const actor = useWorkspaceActor();
  const identity = assignmentIdentityFor(actor);
  const iHaveAssignments = hasAssignmentIdentity(identity);
  const actorId = actor.clinicianId ?? actor.staffId;
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // Part 2: OUD/AUD medication refills show only to roles that pass the
  // substance-use check for that patient; ECM case manager and coordinator are
  // withheld (Access rule: draft pending compliance review).
  const partTwoOk = (r: { patientId: string; medicationName: string }) => {
    if (!isSudMedicationName(r.medicationName)) return true;
    const p = patients.find((x) => x.id === r.patientId);
    return p ? roleSeesSudMedication(role, p) : false;
  };
  const visiblePending = allPending.filter(partTwoOk);
  const minePending = visiblePending.filter((r) => {
    const p = patients.find((x) => x.id === r.patientId);
    return p ? isAssignedTo(p, identity) : false;
  });
  // Staff with no assignment identity (or nothing assigned) would open on an
  // empty tile, which hides real work — they start on the full list instead.
  const canScopeMine = iHaveAssignments && minePending.length > 0;
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const effectiveScope = canScopeMine ? scope : "all";
  const pending = effectiveScope === "mine" ? minePending : visiblePending;

  const reviewed = allRefills
    .filter((r) => r.status !== "pending" && partTwoOk(r))
    .sort((a, b) => +new Date(b.reviewedAt ?? 0) - +new Date(a.reviewedAt ?? 0))
    .slice(0, 5);

  const scopeToggle = (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5" role="group" aria-label="Refill list scope">
        <Button
          size="sm"
          variant={effectiveScope === "mine" ? "default" : "outline"}
          className="h-7 text-[11px]"
          disabled={!canScopeMine}
          onClick={() => setScope("mine")}
          data-testid="refill-scope-mine"
        >
          My patients ({minePending.length})
        </Button>
        <Button
          size="sm"
          variant={effectiveScope === "all" ? "default" : "outline"}
          className="h-7 text-[11px]"
          onClick={() => setScope("all")}
          data-testid="refill-scope-all"
        >
          All pending ({visiblePending.length})
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{CASELOAD_SCOPE_NOTE}</p>
      {SUD_MED_WITHHELD_ROLES.includes(role) && (
        <p className="text-[11px] text-muted-foreground" data-testid="refill-sud-withheld-note">
          {SUD_MED_ACCESS_NOTE}
        </p>
      )}
    </div>
  );

  const history = reviewed.length > 0 && (
    <div className="mt-3 border-t pt-3">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-0 text-[11px]"
        onClick={() => setShowHistory((v) => !v)}
        data-testid="refill-history-toggle"
      >
        {showHistory ? "Hide recently reviewed" : `Recently reviewed (${reviewed.length})`}
      </Button>
      {showHistory && (
        <ul className="mt-2 space-y-2 text-[11px] text-muted-foreground" data-testid="refill-history">
          {reviewed.map((r) => {
            const p = patients.find((x) => x.id === r.patientId);
            return (
              <li key={r.id}>
                <span className="text-navy dark:text-foreground">
                  {p ? `${p.firstName} ${p.lastName}` : r.patientId} · {r.medicationName}
                </span>{" "}
                — {r.status === "sent_to_pharmacy"
                  ? "approved, sent to pharmacy"
                  : r.status === "needs_appointment"
                    ? "needs an appointment first"
                    : r.status}{" "}
                by{" "}
                {refillReviewerLabel(r.reviewedBy, clinicians)}
                {r.reviewedAt && (
                  <>
                    {" "}
                    · <ClientDate value={r.reviewedAt} />
                  </>
                )}
                {r.denyReason && <div className="italic">Reason: {r.denyReason}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (pending.length === 0) {
    return (
      <Card className="p-5" data-testid="refill-card">
        <h3 className="font-display text-base text-navy flex items-center gap-2">
          <Video className="h-4 w-4" aria-hidden="true" /> Refill requests
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          {effectiveScope === "mine"
            ? "No pending refill requests for your assigned patients."
            : "No pending refill requests."}
        </p>
        {scopeToggle}
        {history}
      </Card>
    );
  }
  return (
    <Card className="p-5" data-testid="refill-card">
      <h3 className="font-display text-base text-navy">Refill requests</h3>
      {scopeToggle}
      <ul className="mt-3 space-y-3 text-sm">
        {pending.map((r) => {
          const p = patients.find((x) => x.id === r.patientId);
          const med = p
            ? AdelanteEHR.listMedications(p.id).find((m) => m.id === r.medicationId)
            : undefined;
          const sig = [med?.dose, med?.frequency].filter(Boolean).join(" · ");
          const canWrite = p ? canAccess(role, "meds_erx", p).level === "write" : false;
          return (
            <li key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-navy truncate">
                    {p ? `${p.firstName} ${p.lastName}` : r.patientId}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.medicationName}
                    {sig && ` · ${sig}`} · requested <ClientDate value={r.requestedAt} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Requested by {r.requestedBy === "patient" ? "patient" : "clinician"}
                  </div>
                  {r.pharmacyNote && (
                    <div className="text-[11px] italic text-muted-foreground mt-1">
                      "{r.pharmacyNote}"
                    </div>
                  )}
                  {!canWrite && (
                    <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Prescriber review required
                    </div>
                  )}
                </div>
                {canWrite && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 text-[11px] bg-teal text-teal-foreground hover:bg-teal/90"
                      onClick={() => {
                        try {
                          AdelanteEHR.reviewRefill({
                            id: r.id,
                            decision: "approved",
                            clinicianId: actorId,
                            actorRole: role,
                          });
                          toast.success("Refill approved and sent to pharmacy");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    >
                      Deny
                    </Button>
                  </div>
                )}
              </div>
              {canWrite && refillNeedsCures(r) && <RefillCuresStep refill={r} />}
              {canWrite && openId === r.id && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="Reason for denial (required)"
                    placeholder="Reason for denial (required, shown to patient)"
                    className="min-h-[50px] text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setOpenId(null);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-[11px]"
                      disabled={!reason.trim()}
                      onClick={() => {
                        try {
                          AdelanteEHR.reviewRefill({
                            id: r.id,
                            decision: "denied",
                            denyReason: reason,
                            clinicianId: actorId,
                            actorRole: role,
                          });
                          setOpenId(null);
                          setReason("");
                          toast.success("Refill denied");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Send denial
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {history}
    </Card>
  );
}

/**
 * §Dashboard Cleanup Phase 6a — My caseload, as a count that links across.
 *
 * Deliberately NOT a second caseload table: the real one on Care Coordination
 * has filters, assignment, export and record drawers. This gives the number
 * and the route, using the same `scopeCaseload(..., "mine")` call that page
 * uses, so the two always agree.
 */
function MyCaseloadCard() {
  const actor = useWorkspaceActor();
  const identity = assignmentIdentityFor(actor);
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const mine = scopeCaseload(patients, identity, "mine");
  return (
    <Card className="p-5" data-testid="clinician-caseload-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base text-navy flex items-center gap-2">
          <Users className="h-4 w-4 text-teal" aria-hidden="true" /> My caseload ({mine.length})
        </h3>
        <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
          <Link to="/case-manager">Open caseload</Link>
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {hasAssignmentIdentity(identity)
          ? mine.length === 0
            ? `No patients are currently assigned to ${actor.staffName}.`
            : "Patients assigned to you. The full list, with filters and assignment, lives on Care Coordination."
          : "Your staff profile isn't linked to a caseload or a provider record, so nothing matches \u201Cassigned to me\u201D."}
      </p>
    </Card>
  );
}
