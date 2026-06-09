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
import { ArrowLeft, CalendarPlus, ShieldCheck, Video, Phone, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const navigate = useNavigate();
  const currentId = useHealthie(() => HealthieService.getCurrentPatientId());
  const patient = useHealthie(() => HealthieService.getPatient(currentId));
  const clinicians = useHealthie(() => HealthieService.listClinicians());
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(50);
  const [modality, setModality] = useState<"video" | "phone">("video");

  if (!patient) return null;

  // Constrain the datetime picker to weekdays 9:00–17:00 in the user's local
  // tz. We derive min/max from "today at 09:00" → "+30 days at 17:00".
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const minD = new Date();
  minD.setHours(9, 0, 0, 0);
  if (minD.getTime() < Date.now()) minD.setDate(minD.getDate() + 1);
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 30);
  maxD.setHours(17, 0, 0, 0);

  const submit = () => {
    if (!start || !clinicianId) {
      toast.error(t("schErrPickTime"));
      return;
    }
    const d = new Date(start);
    const dow = d.getDay();
    const hour = d.getHours();
    if (dow === 0 || dow === 6 || hour < 9 || hour >= 17) {
      toast.error(t("schErrWeekday"));
      return;
    }
    HealthieService.bookAppointment({
      patientId: patient.id,
      clinicianId,
      start: new Date(start).toISOString(),
      durationMin: duration,
    });
    toast.success(t("schRequested"), {
      description: t("schRequestedDesc"),
    });
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/home">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("schBack")}
        </Link>
      </Button>
      <header className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">{t("homeSchedule")}</div>
        <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">
          {t("schTitle")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("schSubtitle")}
        </p>
      </header>

      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">{t("schCounselor")}</Label>
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
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <Clock className="h-3 w-3 text-teal" /> {t("schAvailable")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t("schDate")}</Label>
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            min={fmt(minD)}
            max={fmt(maxD)}
            step={60 * 30}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t("schLength")}</Label>
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
        <div className="space-y-1.5">
          <Label className="text-sm">{t("schPickFormat")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModality("video")}
              className={
                "flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm transition-colors " +
                (modality === "video"
                  ? "border-teal bg-teal/10 text-navy"
                  : "bg-card hover:border-teal/60 text-foreground/70")
              }
            >
              <Video className="h-4 w-4" /> {t("schVideo")}
            </button>
            <button
              type="button"
              onClick={() => setModality("phone")}
              className={
                "flex items-center justify-center gap-2 rounded-md border p-2.5 text-sm transition-colors " +
                (modality === "phone"
                  ? "border-teal bg-teal/10 text-navy"
                  : "bg-card hover:border-teal/60 text-foreground/70")
              }
            >
              <Phone className="h-4 w-4" /> {t("schPhone")}
            </button>
          </div>
        </div>
        <Button className="w-full bg-navy text-navy-foreground hover:bg-navy/90" onClick={submit}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> {t("schRequest")}
        </Button>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-teal mt-0.5" />
          {t("schSafety")}
        </p>
      </Card>
    </div>
  );
}