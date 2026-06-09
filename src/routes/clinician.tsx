import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HealthieService, useHealthie, type SessionStatus } from "@/lib/healthie";
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
  const clinicians = useHealthie(() => HealthieService.listClinicians());
  const patients = useHealthie(() => HealthieService.listPatients());
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.id ?? "");
  const clinician = clinicians.find((c) => c.id === clinicianId);
  const appts = useHealthie(() =>
    clinicianId ? HealthieService.appointmentsForClinician(clinicianId) : [],
  );

  const [book, setBook] = useState({ patientId: patients[0]?.id ?? "", start: "", durationMin: 50 });
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? "");
  const selectedPatient = useHealthie(() => HealthieService.getPatient(selectedPatientId));
  const [newGoal, setNewGoal] = useState("");
  const [planDraft, setPlanDraft] = useState("");
  const [note, setNote] = useState({
    sessionType: "individual" as const,
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });

  const doBook = () => {
    if (!book.patientId || !book.start) {
      toast.error("Pick a patient and a time");
      return;
    }
    HealthieService.bookAppointment({
      patientId: book.patientId,
      clinicianId,
      start: new Date(book.start).toISOString(),
      durationMin: book.durationMin,
    });
    toast.success("Appointment booked", { description: "Synced to Healthie calendar (mock)" });
    setBook({ ...book, start: "" });
  };

  const launch = (id: string) => {
    toast.success("Launching telehealth session", { description: `Healthie video room · session ${id}` });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">Clinician</div>
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
            <SelectValue placeholder="Pick clinician" />
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
          <h2 className="font-display text-lg text-navy">Appointments</h2>
          <RescreenDuePanel patients={patients.filter((p) => appts.some((a) => a.patientId === p.id))} />
          {appts.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No appointments yet.</Card>
          )}
          {appts.map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            const isFuture = new Date(a.start).getTime() > Date.now();
            return (
              <Card key={a.id} className="p-4">
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
                          Billing: {a.billingStatus}
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
                        <Video className="h-4 w-4 mr-1.5" /> Join
                      </Button>
                    )}
                    {a.status === "scheduled" && !isFuture && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => HealthieService.updateAppointmentStatus(a.id, "attended")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5" /> Attended
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => HealthieService.updateAppointmentStatus(a.id, "no_show")}
                        >
                          <XCircle className="h-4 w-4 mr-1.5" /> No-show
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Book + availability */}
        <div className="space-y-3">
          <Card className="p-5">
            <h3 className="font-display text-lg text-navy">Book session</h3>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Patient</Label>
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
                <Label className="text-sm">Date & time</Label>
                <Input type="datetime-local" value={book.start} onChange={(e) => setBook({ ...book, start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Duration</Label>
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
                Book
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-lg text-navy">Availability</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Default hours synced from Healthie provider profile.
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
                <h3 className="font-display text-lg text-navy">Care plan summary</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Plain-language summary visible to the patient on their home screen.
                </p>
                <Textarea
                  className="mt-3 min-h-[100px]"
                  defaultValue={selectedPatient.carePlanSummary}
                  onChange={(e) => setPlanDraft(e.target.value)}
                />
                <Button
                  className="mt-3 bg-navy text-navy-foreground hover:bg-navy/90"
                  onClick={() => {
                    HealthieService.updateCarePlanSummary(
                      selectedPatient.id,
                      planDraft || selectedPatient.carePlanSummary,
                    );
                    toast.success("Care plan updated");
                  }}
                >
                  Save summary
                </Button>
              </Card>
              <Card className="p-5">
                <h3 className="font-display text-lg text-navy">Goals</h3>
                <div className="mt-3 space-y-2">
                  {(selectedPatient.goals ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No goals yet.</p>
                  )}
                  {(selectedPatient.goals ?? []).map((g) => (
                    <div
                      key={g.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <Select
                        value={g.status}
                        onValueChange={(v) =>
                          HealthieService.setGoalStatus(selectedPatient.id, g.id, v as never)
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
                        onClick={() => HealthieService.removeGoal(selectedPatient.id, g.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Add a goal…"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      HealthieService.addGoal(selectedPatient.id, newGoal);
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
                <h3 className="font-display text-lg text-navy">New SOAP note</h3>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Session type</Label>
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
                  {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                    <div key={k} className="space-y-1.5">
                      <Label className="text-sm capitalize">{k}</Label>
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
                      HealthieService.addProgressNote(selectedPatient.id, {
                        clinicianId,
                        date: new Date().toISOString(),
                        sessionType: note.sessionType,
                        subjective: note.subjective,
                        objective: note.objective,
                        assessment: note.assessment,
                        plan: note.plan,
                      });
                      toast.success("Progress note saved");
                      setNote({
                        sessionType: "individual",
                        subjective: "",
                        objective: "",
                        assessment: "",
                        plan: "",
                      });
                    }}
                  >
                    Save note
                  </Button>
                </div>
              </Card>
              <div className="space-y-3">
                <h3 className="font-display text-lg text-navy">Recent notes</h3>
                {(selectedPatient.progressNotes ?? []).length === 0 && (
                  <Card className="p-4 text-sm text-muted-foreground">No notes yet.</Card>
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

function TrendPanel({ patientId }: { patientId: string }) {
  const patient = useHealthie(() => HealthieService.getPatient(patientId));
  if (!patient) return null;
  const history = patient.screenerHistory ?? [];
  const screenerKeys = Array.from(new Set(history.map((h) => h.key)));

  return (
    <div className="space-y-6 mt-4">
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display text-lg text-navy">Screener trend</h3>
            <p className="text-xs text-muted-foreground">
              Markers at day 30 / 60 / 90 (re-screening timepoints).
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
            <CalendarPlus className="h-4 w-4 mr-1.5" /> Schedule re-screen
          </Button>
        </div>
        {screenerKeys.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No screener history yet.</p>
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
                      Latest: {data[data.length - 1]?.score} ·{" "}
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
  const rows = patients.flatMap((p) =>
    HealthieService.rescreensDue(p.id).map((d) => ({ ...d, patient: p })),
  );
  if (rows.length === 0) return null;
  return (
    <Card className="p-4 bg-gold/10 border-gold/40">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-navy">
        <CalendarPlus className="h-4 w-4" /> Re-screens due
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium text-navy">
                {r.patient.firstName} {r.patient.lastName}
              </span>{" "}
              · {r.key.toUpperCase()}{" "}
              <span className="text-xs text-muted-foreground">
                (last {r.lastDays}d ago · day {r.nextDue} due)
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                HealthieService.sendRescreenTask(r.patient.id, r.key);
                toast.success("Re-screen task sent", {
                  description: "Patient will see it on their home screen.",
                });
              }}
            >
              Send re-screen
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}