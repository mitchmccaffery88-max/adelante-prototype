import { Link } from "@tanstack/react-router";
import { HealthieService, useHealthie } from "@/lib/healthie";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Video,
  Smartphone,
  Calendar as CalIcon,
  HeartPulse,
  MapPin,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Target,
  CalendarPlus,
  CheckCircle2,
  Lock,
  Bell,
} from "lucide-react";
import {
  Home,
  Utensils,
  Activity,
  Briefcase,
  FileText,
  Users,
  Car,
  CalendarClock,
  MessageSquare,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { ClientDate } from "@/components/ClientDate";
import { Switch } from "@/components/ui/switch";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { useState } from "react";
import { UserCog, Phone as PhoneIcon, Globe2 } from "lucide-react";

// Reconcile every Patient.needs key with both a translation key and an icon
// so a true value never renders as a blank chip. Unknown keys are filtered
// out defensively in the render below.
const needMeta: Record<
  string,
  { tKey: string; Icon: typeof Home }
> = {
  housing: { tKey: "needHousing", Icon: Home },
  food: { tKey: "needFood", Icon: Utensils },
  substanceUse: { tKey: "needSubstanceUse", Icon: Activity },
  employment: { tKey: "needEmployment", Icon: Briefcase },
  benefits: { tKey: "needBenefits", Icon: FileText },
  family: { tKey: "needFamily", Icon: Users },
  transport: { tKey: "needTransport", Icon: Car },
};

const statusMap: Record<string, string> = {
  scheduled: "statusScheduled",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  no_show: "statusNoShow",
};

const goalStatusMap: Record<string, string> = {
  not_started: "goalNotStarted",
  in_progress: "goalInProgress",
  done: "goalDone",
};

export function PatientHome() {
  const { t } = useI18n();
  const currentId = useHealthie(() => HealthieService.getCurrentPatientId());
  const patient = useHealthie(() => HealthieService.getPatient(currentId));
  const appts = useHealthie(() => HealthieService.appointmentsForPatient(currentId));
  const smsOn = useHealthie(() => HealthieService.isSmsOn(currentId));

  if (!patient) return null;

  // First-time experience: intake not yet completed.
  if (!patient.intakeCompletedAt) {
    return <FirstTimeWelcome firstName={patient.firstName} />;
  }

  const upcoming = appts.filter((a) => a.status === "scheduled");
  const next = upcoming[0];
  const remaining = Math.max(0, 90 - patient.episodeDay);
  const goals = patient.goals ?? [];

  const now = Date.now();
  const futureAppts = [...appts]
    .filter((a) => new Date(a.start).getTime() > now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const pastAppts = [...appts]
    .filter((a) => new Date(a.start).getTime() <= now)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))
    .slice(0, 5);

  const cycleGoal = (goalId: string, current: "open" | "in_progress" | "done") => {
    const nextStatus =
      current === "open" ? "in_progress" : current === "in_progress" ? "done" : "open";
    HealthieService.setGoalStatus(patient.id, goalId, nextStatus);
    toast.success(
      nextStatus === "done"
        ? "Goal marked done — nice work."
        : nextStatus === "in_progress"
          ? "Goal in progress."
          : "Goal reset.",
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      {/* Welcome */}
      <Card className="p-6 border-2 bg-gradient-to-br from-card to-secondary/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-teal">
              {t("homeWelcomeBack")}
            </div>
            <h1 className="font-display text-3xl text-navy mt-1">
              {t("homeHi")}, {patient.firstName}.
            </h1>
            <p className="text-muted-foreground mt-1 max-w-md">
              {t("homeDayOf")} {patient.episodeDay} {t("homeOfPlan")} {remaining} {t("homeDaysRemain")}
            </p>
          </div>
          {smsOn && (
            <Badge className="bg-gold/30 text-navy border-0 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> {t("homeSmsFallback")}
            </Badge>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{t("homeDay")} {patient.episodeDay}</span>
            <span>{t("homeDay")} 90</span>
          </div>
          <Progress value={(patient.episodeDay / 90) * 100} className="h-2" />
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <CalIcon className="h-4 w-4" /> {t("homeNextSession")}
          </div>
          {next ? (
            <>
              <div className="mt-2 font-display text-xl text-navy">
                <ClientDate
                  value={next.start}
                  options={{
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {HealthieService.getClinician(next.clinicianId)?.name} · {next.durationMin} {t("homeMin")} · {t("homeVideo")}
              </div>
              <NotificationLine patientId={patient.id} apptId={next.id} />
              <Button
                className="mt-4 w-full bg-teal text-teal-foreground hover:bg-teal/90"
                onClick={() =>
                  toast.success("Joining video session", {
                    description: "Healthie telehealth (mock)",
                  })
                }
              >
                <Video className="h-4 w-4 mr-2" /> {t("homeJoin")}
              </Button>
            </>
          ) : (
            <>
              <div className="mt-2 text-sm text-muted-foreground">{t("homeNoSessions")}</div>
              <Button
                asChild
                className="mt-4 w-full bg-teal text-teal-foreground hover:bg-teal/90"
              >
                <Link to="/schedule">
                  <CalendarPlus className="h-4 w-4 mr-2" /> {t("homeSchedule")}
                </Link>
              </Button>
            </>
          )}
          {next && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/schedule" search={{ reschedule: next.id }}>
                  <CalendarClock className="h-4 w-4 mr-1.5" /> Reschedule
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/schedule">
                  <CalendarPlus className="h-4 w-4 mr-1.5" /> {t("homeBookAnother")}
                </Link>
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <HeartPulse className="h-4 w-4" /> {t("homeCarePlan")}
          </div>
          <p className="mt-2 text-foreground">{patient.carePlanSummary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(patient.needs)
              .filter(([k, v]) => v && needMeta[k])
              .map(([k]) => {
                const meta = needMeta[k];
                const Icon = meta.Icon;
                return (
                  <Badge key={k} variant="outline" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {t(meta.tKey as any)}
                  </Badge>
                );
              })}
            {Object.values(patient.needs).every((v) => !v) && (
              <span className="text-xs text-muted-foreground">
                No support needs flagged yet.
              </span>
            )}
          </div>
        </Card>
      </div>

      {goals.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <Target className="h-4 w-4" /> {t("homeYourGoals")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("homeGoalsHelp")} {t("patGoalTapHint")}
          </p>
          <ul className="mt-3 space-y-2">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-start gap-2 rounded-md border p-2.5 text-sm cursor-pointer hover:border-teal transition-colors"
                onClick={() => cycleGoal(g.id, g.status)}
                role="button"
                aria-label={`Update goal: ${g.text}`}
              >
                <CheckCircle2
                  className={
                    "h-4 w-4 mt-0.5 shrink-0 " +
                    (g.status === "done"
                      ? "text-success"
                      : g.status === "in_progress"
                        ? "text-teal"
                        : "text-muted-foreground")
                  }
                />
                <span className="flex-1">
                  <span
                    className={
                      g.status === "done" ? "line-through text-muted-foreground" : "text-foreground"
                    }
                  >
                    {g.text}
                  </span>
                </span>
                <Badge variant="outline" className="capitalize text-xs">
                  {t((goalStatusMap[g.status] ?? g.status) as any)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <TasksCard patientId={patient.id} />
      <MyProfileCard patientId={patient.id} />

      <div>
        <h2 className="font-display text-lg text-navy mb-3">{t("patUpcoming")}</h2>
        <div className="space-y-2">
          {futureAppts.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">{t("patNoneUpcoming")}</Card>
          ) : (
            futureAppts.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="text-navy font-medium">
                    <ClientDate value={a.start} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {HealthieService.getClinician(a.clinicianId)?.name}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {t((statusMap[a.status] ?? a.status) as any)}
                </Badge>
              </Card>
            ))
          )}
        </div>
      </div>
      <div>
        <h2 className="font-display text-lg text-navy mb-3">{t("patHistory")}</h2>
        <div className="space-y-2">
          {pastAppts.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">{t("patNoneHistory")}</Card>
          ) : (
            pastAppts.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="text-navy font-medium">
                    <ClientDate value={a.start} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {HealthieService.getClinician(a.clinicianId)?.name}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {t((statusMap[a.status] ?? a.status) as any)}
                </Badge>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Privacy & Consent — moved to bottom so it sits beneath upcoming/history */}
      <ConsentCard patientId={patient.id} />
    </div>
  );
}

function FirstTimeWelcome({ firstName }: { firstName: string }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 space-y-6">
      <Card className="p-8 border-2 bg-gradient-to-br from-card via-card to-teal/10 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl"
        />
        <div className="inline-flex items-center gap-2 rounded-full bg-teal/15 text-teal px-3 py-1 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> {t("homeWelcomeTitle")}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-navy mt-4 leading-tight">
          {t("homeHi")} {firstName} — {t("homeSetupCare")}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl">
          {t("homeIntakeBlurb")}
        </p>

        <ul className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
          <li className="rounded-lg border bg-card p-3">
            <div className="font-medium text-navy">{t("homePrivate")}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {t("homePrivateDesc")}
            </div>
          </li>
          <li className="rounded-lg border bg-card p-3">
            <div className="font-medium text-navy">{t("homeYourPace")}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {t("homeYourPaceDesc")}
            </div>
          </li>
          <li className="rounded-lg border bg-card p-3">
            <div className="font-medium text-navy">{t("homeRealHelp")}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {t("homeRealHelpDesc")}
            </div>
          </li>
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            asChild
            size="lg"
            className="bg-navy text-navy-foreground hover:bg-navy/90"
          >
            <Link to="/intake">
              <ClipboardList className="mr-2 h-4 w-4" />
              {t("homeStartIntake")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" />
            {t("homeConsentNote")}
          </div>
        </div>
      </Card>
    </div>
  );
}

function TasksCard({ patientId }: { patientId: string }) {
  const tasks = useHealthie(() => HealthieService.getPatient(patientId)?.tasks ?? []);
  const open = tasks.filter((t) => !t.completedAt);
  if (open.length === 0) return null;
  return (
    <Card className="p-5 border-teal/40 bg-teal/5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Bell className="h-4 w-4" /> Things to do
      </div>
      <ul className="mt-3 space-y-2">
        {open.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
            <span className="flex-1 text-foreground">{t.label}</span>
            {t.kind === "rescreen" ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/intake">Start</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  HealthieService.completeTask(patientId, t.id);
                  toast.success("Marked done");
                }}
              >
                Done
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MyProfileCard({ patientId }: { patientId: string }) {
  const patient = useHealthie(() => HealthieService.getPatient(patientId));
  const [open, setOpen] = useState(false);
  if (!patient) return null;
  const channelLabel: Record<string, string> = {
    text: "Text",
    call: "Phone call",
    video: "Video",
  };
  const timeLabel: Record<string, string> = {
    morning: "Mornings",
    afternoon: "Afternoons",
    evening: "Evenings",
  };
  const langLabel: Record<string, string> = { en: "English", es: "Español" };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
          <UserCog className="h-4 w-4" /> My profile
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
      <dl className="mt-3 grid sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <Row label="Name">
          {patient.firstName} {patient.lastName}
          {patient.preferredName ? (
            <span className="text-muted-foreground"> · "{patient.preferredName}"</span>
          ) : null}
        </Row>
        {patient.pronouns && <Row label="Pronouns">{patient.pronouns}</Row>}
        <Row label="Phone">
          {patient.phone ? (
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" /> {patient.phone}
            </span>
          ) : (
            <span className="text-muted-foreground">Not on file</span>
          )}
        </Row>
        <Row label="Language">
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
            {langLabel[patient.preferredLanguage ?? "en"]}
          </span>
        </Row>
        {patient.contactPrefs && (
          <Row label="Contact">
            {channelLabel[patient.contactPrefs.channel]} · {timeLabel[patient.contactPrefs.bestTime]}
          </Row>
        )}
        {patient.address && <Row label="Address">{patient.address}</Row>}
        {patient.emergencyContact?.name && (
          <Row label="Emergency">
            {patient.emergencyContact.name}
            {patient.emergencyContact.relationship
              ? ` (${patient.emergencyContact.relationship})`
              : ""}
            {patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ""}
          </Row>
        )}
      </dl>
      <PatientProfileDialog patientId={patientId} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function NotificationLine({ patientId, apptId }: { patientId: string; apptId: string }) {
  const note = useHealthie(() =>
    HealthieService.latestNotificationForAppt(patientId, apptId),
  );
  if (!note) return null;
  const verb =
    note.kind === "booked"
      ? "Booked"
      : note.kind === "rescheduled"
        ? "Rescheduled"
        : note.kind === "cancelled"
          ? "Cancelled"
          : "Confirmed";
  const chans = note.channels
    .map((c) => (c === "profile" ? "profile" : c === "sms" ? "text" : "email"))
    .join(" + ");
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal">
      <CheckCircle2 className="h-3 w-3" />
      {verb} · notified via {chans}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-muted-foreground w-24 shrink-0">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function ConsentCard({ patientId }: { patientId: string }) {
  const consent = useHealthie(() => HealthieService.getConsentState(patientId));
  const rows: { key: "part2Sud" | "ecmShare" | "sms"; label: string; help: string }[] = [
    {
      key: "part2Sud",
      label: "Share substance-use information with my care team",
      help: "42 CFR Part 2 — only your Adelante care team. Never probation/parole.",
    },
    {
      key: "ecmShare",
      label: "Share with Enhanced Care Management partners",
      help: "Lets housing, food, and reentry partners coordinate.",
    },
    {
      key: "sms",
      label: "Text-message reminders",
      help: "Appointment and check-in reminders by SMS.",
    },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Lock className="h-4 w-4" /> Privacy & consent
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        You can change these at any time. Changes apply right away.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-3 rounded-md border p-3">
            <Switch
              checked={consent[r.key]}
              onCheckedChange={(v) => {
                HealthieService.setConsent(patientId, r.key, v);
                toast.success(v ? "Consent granted" : "Consent withdrawn");
              }}
            />
            <div className="text-sm flex-1">
              <div className="font-medium text-foreground">{r.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{r.help}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
