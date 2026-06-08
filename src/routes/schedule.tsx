import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HealthieService, useHealthie } from "@/lib/healthie";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule a session — Adelante" },
      { name: "description", content: "Book a private video or phone session with your care team." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const navigate = useNavigate();
  const currentId = useHealthie(() => HealthieService.getCurrentPatientId());
  const patient = useHealthie(() => HealthieService.getPatient(currentId));
  const clinicians = useHealthie(() => HealthieService.listClinicians());
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(50);

  if (!patient) return null;

  const submit = () => {
    if (!start || !clinicianId) {
      toast.error("Pick a counselor and a time.");
      return;
    }
    HealthieService.bookAppointment({
      patientId: patient.id,
      clinicianId,
      start: new Date(start).toISOString(),
      durationMin: duration,
    });
    toast.success("Session requested", {
      description: "Your care team will confirm shortly. We'll text you a reminder.",
    });
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to my care
        </Link>
      </Button>
      <header className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">Schedule</div>
        <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">
          Book a session
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pick a time that works for you. Sessions are private video or phone — your choice.
        </p>
      </header>

      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Counselor</Label>
          <Select value={clinicianId} onValueChange={setClinicianId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clinicians.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}, {c.credential}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Date & time</Label>
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Length</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="50">50 minutes</SelectItem>
              <SelectItem value="60">60 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full bg-navy text-navy-foreground hover:bg-navy/90" onClick={submit}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> Request session
        </Button>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-teal mt-0.5" />
          Your session is private and protected. Free with Medi-Cal.
        </p>
      </Card>
    </div>
  );
}