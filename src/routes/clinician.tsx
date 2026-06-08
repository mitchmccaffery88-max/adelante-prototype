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
  const clinicians = useHealthie(() => HealthieService.listClinicians());
  const patients = useHealthie(() => HealthieService.listPatients());
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.id ?? "");
  const clinician = clinicians.find((c) => c.id === clinicianId);
  const appts = useHealthie(() =>
    clinicianId ? HealthieService.appointmentsForClinician(clinicianId) : [],
  );

  const [book, setBook] = useState({ patientId: patients[0]?.id ?? "", start: "", durationMin: 50 });

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
          <h1 className="font-display text-3xl text-navy mt-1">Today's schedule</h1>
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display text-lg text-navy">Appointments</h2>
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
    </div>
  );
}