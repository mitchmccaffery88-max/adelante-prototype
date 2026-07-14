import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr, type SessionStatus } from "@/lib/ehr";
import { SCREENERS, severityFor } from "@/lib/screeners";
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
  Target,
  Trash2,
  Plus,
  FileText,
  TrendingUp,
  CalendarPlus,
  TrendingDown,
  Minus,
} from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { useI18n } from "@/lib/i18n";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/clinician")({
  head: () => ({
    meta: [
      { title: "Clinician Scheduler — Adelante" },
      { name: "description", content: "Caseload, scheduler, video sessions, and billing status." },
    ],
  }),
  component: ClinicianPage,
});

const statusBadge: Record<SessionStatus, string> = {
  scheduled: "bg-teal/15 text-teal",
  attended: "bg-success/20 text-success",
  no_show: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function ClinicianPage() {
  const { t } = useI18n();
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.id ?? "");
  const clinician = clinicians.find((c) => c.id === clinicianId);
  const appts = useEhr(() =>
    clinicianId ? AdelanteEHR.appointmentsForClinician(clinicianId) : [],
  );

  const [book, setBook] = useState({ patientId: patients[0]?.id ?? "", start: "", durationMin: 50 });
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? "");
  const selectedPatient = useEhr(() => AdelanteEHR.getPatient(selectedPatientId));
  const [newGoal, setNewGoal] = useState("");
  const [planDraft, setPlanDraft] = useState("");
  const [note, setNote] = useState({
    sessionType: "individual" as const,
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    appointmentId: "" as string,
  });

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
      });
      toast.success("Appointment booked", { description: "Synced to provider calendar (mock)" });
      setBook({ ...book, start: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book that time.");
    }
  };

  const launch = (id: string) => {
    toast.success("Launching telehealth session", { description: `Adelante video room · session ${id}` });
  };

  // Bucket appointments by time horizon for the schedule view.
  const now = Date.now();
  const endOfToday = (() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
  })();
  const endOfWeek = (() => {
    const d = new Date();
    const dow = d.getDay();
    const daysUntilSun = 7 - dow;
    d.setDate(d.getDate() + daysUntilSun);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  })();
  const sortedAppts = [...appts].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const todayAppts = sortedAppts.filter((a) => +new Date(a.start) <= endOfToday && +new Date(a.start) >= now - 7 * 24 * 3600 * 1000);
  const weekAppts = sortedAppts.filter((a) => +new Date(a.start) > endOfToday && +new Date(a.start) <= endOfWeek);
  const laterAppts = sortedAppts.filter((a) => +new Date(a.start) > endOfWeek);

  // Pre-fill the notes form's "Link to appointment" with the patient's most
  // recent attended (or next scheduled) appointment, so the default isn't
  // "unlinked".
  const patientAppts = useEhr(() =>
    selectedPatientId ? AdelanteEHR.appointmentsForPatient(selectedPatientId) : [],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">{t("navClinician")}</div>
          <h1 className="font-display text-3xl text-navy mt-1">{t("clinTitle")}</h1>
          {clinician && (
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal" />
              Medi-Cal:{" "}
              <Badge
                className={
                  clinician.mediCalStatus === "active"
                    ? "bg-success/20 text-success border-0"
                    : clinician.mediCalStatus === "pending"
                      ? "bg-gold/30 text-navy border-0"
                      : "bg-destructive/15 text-destructive border-0"
                }
              >
                {clinician.mediCalStatus}
              </Badge>
            </div>
          )}
        </div>
        <Select value={clinicianId} onValueChange={setClinicianId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={t("clinPickClinician")} />
          </SelectTrigger>
          <SelectContent>
            {clinicians.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}, {c.credential}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="schedule">
            <CalIcon className="h-4 w-4 mr-1.5" /> {t("clinSchedule")}
          </TabsTrigger>
          <TabsTrigger value="care-plan">
            <Target className="h-4 w-4 mr-1.5" /> {t("clinCarePlan")}
          </TabsTrigger>
          <TabsTrigger value="notes">
            <FileText className="h-4 w-4 mr-1.5" /> {t("clinNotes")}
          </TabsTrigger>
          <TabsTrigger value="tracking">
            <TrendingUp className="h-4 w-4 mr-1.5" /> {t("clinTracking")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display text-lg text-navy">{t("clinAppointments")}</h2>
          <RescreenDuePanel patients={patients.filter((p) => appts.some((a) => a.patientId === p.id))} />
          {appts.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">{t("clinNoAppts")}</Card>
          )}
          {todayAppts.length > 0 && (
            <>
              <SectionHeader label={t("clinToday")} count={todayAppts.length} />
              {todayAppts.map((a) => <ApptCard key={a.id} a={a} patients={patients} launch={launch} t={t} />)}
            </>
          )}
          {weekAppts.length > 0 && (
            <>
              <SectionHeader label={t("clinThisWeek")} count={weekAppts.length} />
              {weekAppts.map((a) => <ApptCard key={a.id} a={a} patients={patients} launch={launch} t={t} />)}
            </>
          )}
          {laterAppts.length > 0 && (
            <>
              <SectionHeader label={t("clinLater")} count={laterAppts.length} />
              {laterAppts.map((a) => <ApptCard key={a.id} a={a} patients={patients} launch={launch} t={t} />)}
            </>
          )}
        </div>

        {/* Book + availability */}
        <div className="space-y-3">
          <Card className="p-5">
            <h3 className="font-display text-lg text-navy">{t("clinBookSession")}</h3>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("clinPatient")}</Label>
                <Select value={book.patientId} onValueChange={(v) => setBook({ ...book, patientId: v })}>
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
                <Input type="datetime-local" value={book.start} onChange={(e) => setBook({ ...book, start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("clinDuration")}</Label>
                <Select value={String(book.durationMin)} onValueChange={(v) => setBook({ ...book, durationMin: Number(v) })}>
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
              <Button className="w-full bg-navy text-navy-foreground hover:bg-navy/90" onClick={doBook}>
                {t("clinBook")}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-lg text-navy">{t("clinAvailability")}</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("clinAvailHours")}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                <li key={d} className="flex items-center justify-between border-b last:border-0 py-1.5">
                  <span className="text-foreground/80">{d}</span>
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> 9:00 — 5:00
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="care-plan">
          <PatientPicker patients={patients} value={selectedPatientId} onChange={setSelectedPatientId} />
          {selectedPatient && (
            <div className="grid lg:grid-cols-3 gap-6 mt-4">
              <Card className="p-5 lg:col-span-2">
                <h3 className="font-display text-lg text-navy">{t("clinCarePlanSummary")}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("clinPlanHelp")}
                </p>
                <Textarea
                  className="mt-3 min-h-[100px]"
                  defaultValue={selectedPatient.carePlanSummary}
                  onChange={(e) => setPlanDraft(e.target.value)}
                />
                <Button
                  className="mt-3 bg-navy text-navy-foreground hover:bg-navy/90"
                  onClick={() => {
                    AdelanteEHR.updateCarePlanSummary(
                      selectedPatient.id,
                      planDraft || selectedPatient.carePlanSummary,
                    );
                    toast.success("Care plan updated");
                  }}
                >
                  {t("clinSaveSummary")}
                </Button>
              </Card>
              <Card className="p-5">
                <h3 className="font-display text-lg text-navy">{t("clinGoals")}</h3>
                <div className="mt-3 space-y-2">
                  {(selectedPatient.goals ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("clinNoGoals")}</p>
                  )}
                  {(selectedPatient.goals ?? []).map((g) => (
                    <div
                      key={g.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <Select
                        value={g.status}
                        onValueChange={(v) =>
                          AdelanteEHR.setGoalStatus(selectedPatient.id, g.id, v as never)
                        }
                      >
                        <SelectTrigger className="h-7 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="flex-1 pt-1">{g.text}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => AdelanteEHR.removeGoal(selectedPatient.id, g.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder={t("clinAddGoal")}
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      AdelanteEHR.addGoal(selectedPatient.id, newGoal);
                      setNewGoal("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <PatientPicker patients={patients} value={selectedPatientId} onChange={setSelectedPatientId} />
          {selectedPatient && (
            <div className="grid lg:grid-cols-2 gap-6 mt-4">
              <Card className="p-5">
                <h3 className="font-display text-lg text-navy">{t("clinNewNote")}</h3>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("clinSessionType")}</Label>
                    <Select
                      value={note.sessionType}
                      onValueChange={(v) => setNote({ ...note, sessionType: v as never })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="check_in">Check-in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("clinLinkAppt")}</Label>
                    <Select
                      value={note.appointmentId || "__none"}
                      onValueChange={(v) =>
                        setNote({ ...note, appointmentId: v === "__none" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">{t("clinLinkApptNone")}</SelectItem>
                        {patientAppts
                          .slice()
                          .sort((a, b) => +new Date(b.start) - +new Date(a.start))
                          .slice(0, 8)
                          .map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {new Date(a.start).toLocaleString()} · {a.status}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                    <div key={k} className="space-y-1.5">
                      <Label className="text-sm">{t((`clin${k.charAt(0).toUpperCase()}${k.slice(1)}`) as never)}</Label>
                      <Textarea
                        value={note[k]}
                        onChange={(e) => setNote({ ...note, [k]: e.target.value })}
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button
                    className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
                    onClick={() => {
                      if (!note.subjective.trim()) {
                        toast.error("Add at least a subjective entry");
                        return;
                      }
                      AdelanteEHR.addProgressNote(selectedPatient.id, {
                        clinicianId,
                        date: new Date().toISOString(),
                        sessionType: note.sessionType,
                        subjective: note.subjective,
                        objective: note.objective,
                        assessment: note.assessment,
                        plan: note.plan,
                        appointmentId: note.appointmentId || undefined,
                      });
                      toast.success("Progress note saved");
                      setNote({
                        sessionType: "individual",
                        subjective: "",
                        objective: "",
                        assessment: "",
                        plan: "",
                        appointmentId: "",
                      });
                    }}
                  >
                    {t("clinSaveNote")}
                  </Button>
                </div>
              </Card>
              <div className="space-y-3">
                <h3 className="font-display text-lg text-navy">{t("clinRecentNotes")}</h3>
                {(selectedPatient.progressNotes ?? []).length === 0 && (
                  <Card className="p-4 text-sm text-muted-foreground">{t("clinNoNotes")}</Card>
                )}
                {(selectedPatient.progressNotes ?? []).map((n) => (
                  <Card key={n.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {n.sessionType.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <ClientDate value={n.date} />
                      </span>
                    </div>
                    <dl className="mt-2 space-y-1.5 text-xs">
                      {(["subjective", "objective", "assessment", "plan"] as const).map((k) =>
                        n[k] ? (
                          <div key={k}>
                            <dt className="font-medium text-navy capitalize">{k}</dt>
                            <dd className="text-foreground/80">{n[k]}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tracking">
          <PatientPicker patients={patients} value={selectedPatientId} onChange={setSelectedPatientId} />
          {selectedPatient && (
            <TrendPanel patientId={selectedPatient.id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatientPicker({
  patients,
  value,
  onChange,
}: {
  patients: { id: string; firstName: string; lastName: string; episodeDay: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">Patient</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[280px]">
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
}: {
  a: ReturnType<typeof AdelanteEHR.appointmentsForClinician>[number];
  patients: ReturnType<typeof AdelanteEHR.listPatients>;
  launch: (id: string) => void;
  t: (k: never) => string;
}) {
  const p = patients.find((x) => x.id === a.patientId);
  const isFuture = new Date(a.start).getTime() > Date.now();
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-navy/10 text-navy grid place-items-center">
            <CalIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium text-navy">
              {p?.firstName} {p?.lastName}
            </div>
            <div className="text-xs text-muted-foreground">
              <ClientDate value={a.start} /> · {a.durationMin} min
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className={`${statusBadge[a.status]} border-0 capitalize`}>
                {a.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {(t as (k: string) => string)("clinBillingPrefix")}: {a.billingStatus}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isFuture && a.status === "scheduled" && (
            <Button
              size="sm"
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => launch(a.id)}
            >
              <Video className="h-4 w-4 mr-1.5" /> {(t as (k: string) => string)("clinJoin")}
            </Button>
          )}
          {a.status === "scheduled" && !isFuture && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => AdelanteEHR.updateAppointmentStatus(a.id, "attended")}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> {(t as (k: string) => string)("clinAttended")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => AdelanteEHR.updateAppointmentStatus(a.id, "no_show")}
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

function TrendPanel({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!patient) return null;
  const history = patient.screenerHistory ?? [];
  const screenerKeys = Array.from(new Set(history.map((h) => h.key)));

  return (
    <div className="space-y-6 mt-4">
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display text-lg text-navy">{t("clinTrendTitle")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("clinTrendHelp")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast.success("Re-screen scheduled", {
                description: "Patient will be prompted at their next login.",
              })
            }
          >
            <CalendarPlus className="h-4 w-4 mr-1.5" /> {t("clinScheduleRescreen")}
          </Button>
        </div>
        {screenerKeys.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("clinNoHistory")}</p>
        ) : (
          <div className="mt-4 space-y-6">
            {screenerKeys.map((key) => {
              const def = SCREENERS.find((s) => s.key === key);
              const data = history
                .filter((h) => h.key === key)
                .sort((a, b) => +new Date(a.completedAt) - +new Date(b.completedAt))
                .map((h) => ({
                  date: new Date(h.completedAt).toLocaleDateString(),
                  score: h.score,
                  timepoint: h.timepoint,
                }));
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between">
                    <h4 className="font-medium text-navy">{def?.name ?? key}</h4>
                    <span className="text-xs text-muted-foreground">
                      {t("clinLatest")}: {data[data.length - 1]?.score} ·{" "}
                      {def ? severityFor(def, data[data.length - 1]?.score ?? 0) : ""}
                    </span>
                  </div>
                  <div className="h-44 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis fontSize={11} />
                        <RTooltip />
                        {data.map((d, i) =>
                          d.timepoint && d.timepoint !== "adhoc" ? (
                            <ReferenceLine
                              key={i}
                              x={d.date}
                              stroke="var(--teal)"
                              strokeDasharray="4 4"
                              label={{ value: d.timepoint, fontSize: 10, fill: "var(--teal)" }}
                            />
                          ) : null,
                        )}
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="var(--navy)"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function RescreenDuePanel({ patients }: { patients: { id: string; firstName: string; lastName: string }[] }) {
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
            if (latest.score < prev.score) { TrendIcon = TrendingDown; trendCls = "text-success"; }
            else if (latest.score > prev.score) { TrendIcon = TrendingUp; trendCls = "text-destructive"; }
            else { TrendIcon = Minus; trendCls = "text-muted-foreground"; }
          }
          return (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
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
                <span className="text-xs text-muted-foreground">
                  (day {r.nextDue} due)
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
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