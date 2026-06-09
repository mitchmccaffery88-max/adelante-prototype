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
} from "lucide-react";
import { toast } from "sonner";
import { ClientDate } from "@/components/ClientDate";

const needMap: Record<string, string> = {
  housing: "needHousing",
  substanceUse: "needSubstanceUse",
  employment: "needEmployment",
  benefits: "needBenefits",
  family: "needFamily",
  transportation: "needTransportation",
};

const statusMap: Record<string, string> = {
  scheduled: "statusScheduled",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  no_show: "statusNoShow",
};

export function PatientHome() {
  const { t } = useI18n();
  const currentId = useHealthie(() => HealthieService.getCurrentPatientId());
  const patient = useHealthie(() => HealthieService.getPatient(currentId));
  const appts = useHealthie(() => HealthieService.appointmentsForPatient(currentId));

  if (!patient) return null;

  // First-time experience: intake not yet completed.
  if (!patient.intakeCompletedAt) {
    return <FirstTimeWelcome firstName={patient.firstName} />;
  }

  const upcoming = appts.filter((a) => a.status === "scheduled");
  const next = upcoming[0];
  const remaining = Math.max(0, 90 - patient.episodeDay);
  const goals = patient.goals ?? [];

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
          {patient.smsFallback && (
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
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-2 w-full"
            >
              <Link to="/schedule">
                <CalendarPlus className="h-4 w-4 mr-1.5" /> {t("homeBookAnother")}
              </Link>
            </Button>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <HeartPulse className="h-4 w-4" /> {t("homeCarePlan")}
          </div>
          <p className="mt-2 text-foreground">{patient.carePlanSummary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(patient.needs)
              .filter(([, v]) => v)
              .map(([k]) => (
                <Badge key={k} variant="outline" className="capitalize">
                  <MapPin className="h-3 w-3 mr-1" />
                  {t((needMap[k] ?? k) as any)}
                </Badge>
              ))}
          </div>
        </Card>
      </div>

      {goals.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <Target className="h-4 w-4" /> {t("homeYourGoals")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("homeGoalsHelp")}
          </p>
          <ul className="mt-3 space-y-2">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-start gap-2 rounded-md border p-2.5 text-sm"
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
                  {g.status.replace("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <h2 className="font-display text-lg text-navy mb-3">{t("homeAllSessions")}</h2>
        <div className="space-y-2">
          {appts.map((a) => (
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
                {t((statusMap[a.status] ?? a.status) as any).replace("_", " ")}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
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
