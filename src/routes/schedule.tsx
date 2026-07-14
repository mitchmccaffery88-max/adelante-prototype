import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
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
  CalendarClock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ScheduleSearch = { reschedule?: string };

export const Route = createFileRoute("/schedule")({
  validateSearch: (s: Record<string, unknown>): ScheduleSearch => ({
    reschedule: typeof s.reschedule === "string" ? s.reschedule : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Schedule a session — Adelante" },
      {
        name: "description",
        content: "Book a private video or phone session with your care team.",
      },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { reschedule: rescheduleId } = Route.useSearch();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const existing = useEhr(() =>
    rescheduleId
      ? AdelanteEHR.appointmentsForPatient(currentId).find(
          (a) => a.id === rescheduleId,
        )
      : undefined,
  );
  const isReschedule = Boolean(rescheduleId && existing);
  const [clinicianId, setClinicianId] = useState(
    existing?.clinicianId ?? clinicians[0]?.id ?? "",
  );
  const [selectedStart, setSelectedStart] = useState<string>("");
  const [duration, setDuration] = useState(existing?.durationMin ?? 50);
  const [modality, setModality] = useState<"video" | "phone">("video");
  const [activeDayKey, setActiveDayKey] = useState<string>("");

  const availability = useEhr(() =>
    clinicianId ? AdelanteEHR.getClinicianAvailability(clinicianId, 14) : [],
  );

  const dayGroups = useMemo(() => {
    const map = new Map<
      string,
      { date: Date; slots: typeof availability }
    >();
    for (const s of availability) {
      const d = new Date(s.start);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, { date: d, slots: [] });
      map.get(key)!.slots.push(s);
    }
    return Array.from(map.values()).slice(0, 14);
  }, [availability]);

  const activeDay =
    dayGroups.find((g) => g.date.toDateString() === activeDayKey) ?? dayGroups[0];

  if (!patient) return null;

  const submit = () => {
    if (!selectedStart || !clinicianId) {
      toast.error("Pick a time that works for you.");
      return;
    }
    try {
      if (isReschedule && existing) {
        AdelanteEHR.rescheduleAppointment(existing.id, selectedStart);
        toast.success("Session rescheduled", {
          description: "Your care team and you have been notified.",
        });
      } else {
        AdelanteEHR.bookAppointment({
          patientId: patient.id,
          clinicianId,
          start: selectedStart,
          durationMin: duration,
        });
        toast.success(t("schRequested"), { description: t("schRequestedDesc") });
      }
      navigate({ to: "/home" });
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
          {isReschedule ? "Reschedule" : t("homeSchedule")}
        </div>
        <h1 className="font-display text-2xl sm:text-3xl text-navy mt-1">
          {isReschedule ? "Pick a new time" : t("schTitle")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isReschedule
            ? "These are your counselor's open times pulled from their live calendar."
            : t("schSubtitle")}
        </p>
      </header>

      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">{t("schCounselor")}</Label>
          <Select
            value={clinicianId}
            onValueChange={(v) => {
              setClinicianId(v);
              setSelectedStart("");
              setActiveDayKey("");
            }}
            disabled={isReschedule}
          >
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
            <CalendarClock className="h-3 w-3 text-teal" /> Times come from your
            counselor's live calendar. You can only pick what's open.
          </p>
        </div>

        {dayGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-secondary/30 p-4 text-sm text-muted-foreground">
            No openings with this counselor in the next two weeks. Try another
            counselor above, or contact your case manager for help.
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-sm">Pick a day</Label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dayGroups.map((g) => {
                  const key = g.date.toDateString();
                  const open = g.slots.filter((s) => !s.taken).length;
                  const isActive =
                    (activeDay?.date.toDateString() ?? "") === key;
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
                        "shrink-0 rounded-lg border px-3 py-2 text-center text-xs transition-colors " +
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
                      <div className="text-base text-navy font-display">
                        {g.date.getDate()}
                      </div>
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
              <div className="grid grid-cols-3 gap-2">
                {activeDay?.slots.map((s) => {
                  const isActive = selectedStart === s.start;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => !s.taken && setSelectedStart(s.start)}
                      disabled={s.taken}
                      className={
                        "rounded-md border p-2 text-sm transition-colors " +
                        (isActive
                          ? "border-teal bg-teal/10 text-navy font-medium"
                          : s.taken
                            ? "opacity-40 line-through cursor-not-allowed"
                            : "bg-card hover:border-teal/60")
                      }
                    >
                      {new Date(s.start).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm">{t("schLength")}</Label>
          <Select
            value={String(duration)}
            onValueChange={(v) => setDuration(Number(v))}
          >
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
      </Card>
    </div>
  );
}
