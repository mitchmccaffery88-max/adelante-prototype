import { Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n, type Key } from "@/lib/i18n";
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
  HandHeart,
} from "lucide-react";
import { toast } from "sonner";
import { ClientDate } from "@/components/ClientDate";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { CarePlanCard } from "@/components/CarePlanCard";
import { CrisisNotice } from "@/components/CrisisNotice";
import { CareMessageThread } from "@/components/messages/CareMessageThread";
import { InstallAppButton } from "@/components/InstallAppButton";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";
import { useEffect, useState } from "react";
import { UserCog, Phone as PhoneIcon, Globe2 } from "lucide-react";
import { Pill, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { Medication } from "@/lib/ehr";

// Reconcile every Patient.needs key with both a translation key and an icon
// so a true value never renders as a blank chip. Unknown keys are filtered
// out defensively in the render below.
const needMeta: Record<string, { tKey: Key; Icon: typeof Home }> = {
  housing: { tKey: "needHousing", Icon: Home },
  food: { tKey: "needFood", Icon: Utensils },
  substanceUse: { tKey: "needSubstanceUse", Icon: Activity },
  employment: { tKey: "needEmployment", Icon: Briefcase },
  benefits: { tKey: "needBenefits", Icon: FileText },
  family: { tKey: "needFamily", Icon: Users },
  transport: { tKey: "needTransport", Icon: Car },
};

const statusMap: Record<string, Key> = {
  scheduled: "statusScheduled",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  no_show: "statusNoShow",
};

const goalStatusMap: Record<string, Key> = {
  not_started: "goalNotStarted",
  in_progress: "goalInProgress",
  done: "goalDone",
};

const HOME_SCREEN_NUDGE_KEY = "adelante.homeScreenNudgeDismissed";

function HomeScreenNudge() {
  const [dismissed, setDismissed] = useState(true);
  const { prompt } = usePwaInstallPrompt();

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(HOME_SCREEN_NUDGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Only show the nudge when the browser actually supports the install prompt.
  if (dismissed || !prompt) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(HOME_SCREEN_NUDGE_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  return (
    <Card className="p-4 border-teal/40 bg-teal/5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-medium text-navy">Keep Adelante one tap away</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add this app to your home screen for quick access to your care.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <InstallAppButton onInstalled={dismiss} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dismiss"
          className="min-h-[44px] min-w-[44px]"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function PatientHome() {
  const { t } = useI18n();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const appts = useEhr(() => AdelanteEHR.appointmentsForPatient(currentId));
  const smsOn = useEhr(() => AdelanteEHR.isSmsOn(currentId));

  if (!patient) return null;

  // First-time experience: intake not yet completed.
  if (!patient.intakeCompletedAt) {
    return <FirstTimeWelcome firstName={patient.firstName} />;
  }

  const upcoming = appts.filter((a) => a.status === "scheduled");
  const next = upcoming[0];
  const remaining = Math.max(0, 90 - patient.episodeDay);
  const goals = patient.goals ?? [];
  const meds = AdelanteEHR.listMedications(patient.id);

  const now = Date.now();
  const futureAppts = [...appts]
    .filter((a) => new Date(a.start).getTime() > now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const pastAppts = [...appts]
    .filter((a) => new Date(a.start).getTime() <= now)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      {/* Welcome */}
      <Card className="p-6 border-2 bg-gradient-to-br from-card to-secondary/40">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-teal">
              {t("homeWelcomeBack")}
            </div>
            <h1 className="font-display text-3xl text-navy mt-1">
              {t("homeHi")}, {patient.firstName}.
            </h1>
            <p className="text-muted-foreground mt-1 max-w-md">
              {t("homeDayOf")} {patient.episodeDay} {t("homeOfPlan")} {remaining}{" "}
              {t("homeDaysRemain")}
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
            <span>
              {t("homeDay")} {patient.episodeDay}
            </span>
            <span>{t("homeDay")} 90</span>
          </div>
          <Progress value={(patient.episodeDay / 90) * 100} className="h-2" />
        </div>
      </Card>

      <HomeScreenNudge />

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
                {AdelanteEHR.getClinician(next.clinicianId)?.name} · {next.durationMin}{" "}
                {t("homeMin")} ·{" "}
                {next.modality === "phone"
                  ? t("schPhone")
                  : next.modality === "in_person"
                    ? "In person"
                    : t("homeVideo")}
                {next.serviceType &&
                  ` · ${AdelanteEHR.getServiceType(next.serviceType)?.label ?? ""}`}
              </div>
              {next.modality === "in_person" &&
                next.locationId &&
                (() => {
                  const loc = AdelanteEHR.getLocation(next.locationId);
                  if (!loc) return null;
                  return (
                    <div className="mt-1 text-xs text-muted-foreground flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-teal mt-0.5" />
                      <span>
                        {loc.name} — {loc.address}, {loc.city}
                        {loc.room ? ` · ${loc.room}` : ""}
                      </span>
                    </div>
                  );
                })()}
              <NotificationLine patientId={patient.id} apptId={next.id} />
              <Button
                className="mt-4 w-full bg-teal text-teal-foreground hover:bg-teal/90"
                onClick={() =>
                  toast.success("Joining video session", {
                    description: "Adelante telehealth (mock)",
                  })
                }
              >
                <Video className="h-4 w-4 mr-2" /> {t("homeJoin")}
              </Button>
            </>
          ) : (
            <>
              <div className="mt-2 text-sm text-muted-foreground">{t("homeNoSessions")}</div>
              <Button asChild className="mt-4 w-full bg-teal text-teal-foreground hover:bg-teal/90">
                <Link to="/schedule">
                  <CalendarPlus className="h-4 w-4 mr-2" /> {t("homeSchedule")}
                </Link>
              </Button>
            </>
          )}
          {next && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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

      {/* Grouped care-plan section: plan summary + goals, support needs, referrals. */}
      <section
        aria-labelledby="your-care-plan-heading"
        className="rounded-xl border-2 border-teal/30 bg-secondary/30 p-4 sm:p-5"
      >
        <h2
          id="your-care-plan-heading"
          className="font-display text-lg text-navy flex items-center gap-2"
        >
          <HeartPulse className="h-5 w-5 text-teal" /> Your Care Plan
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t("homeGoalsHelp")}
        </p>
        <div className="mt-4 divide-y divide-border/60 space-y-4 [&>*+*]:pt-4">
          <CarePlanCard patientId={patient.id} audience="patient" className="bg-card" />
          <SupportPlanCard patientId={patient.id} />
          <ReferralsForYouCard patientId={patient.id} />
        </div>
      </section>

      {meds.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <Pill className="h-4 w-4" /> My medications
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Managed with your care team through eScribe.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {meds.map((m) => (
              <MedRow key={m.id} med={m} patientId={patient.id} />
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Questions about your medication? Message your care team.
          </p>
        </Card>
      )}

      <TasksCard patientId={patient.id} />
      <MessagesCard patientId={patient.id} />
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
                    {AdelanteEHR.getClinician(a.clinicianId)?.name}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {t(statusMap[a.status] ?? (a.status as Key))}
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
                    {AdelanteEHR.getClinician(a.clinicianId)?.name}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {t(statusMap[a.status] ?? (a.status as Key))}
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
        <p className="text-muted-foreground mt-3 max-w-xl">{t("homeIntakeBlurb")}</p>

        <ul className="mt-6 grid sm:grid-cols-3 gap-3 text-sm">
          <li className="rounded-lg border bg-card p-3">
            <div className="font-medium text-navy">{t("homePrivate")}</div>
            <div className="text-muted-foreground text-xs mt-0.5">{t("homePrivateDesc")}</div>
          </li>
          <li className="rounded-lg border bg-card p-3">
            <div className="font-medium text-navy">{t("homeYourPace")}</div>
            <div className="text-muted-foreground text-xs mt-0.5">{t("homeYourPaceDesc")}</div>
          </li>
          <li className="rounded-lg border bg-card p-3">
            <div className="font-medium text-navy">{t("homeRealHelp")}</div>
            <div className="text-muted-foreground text-xs mt-0.5">{t("homeRealHelpDesc")}</div>
          </li>
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-navy text-navy-foreground hover:bg-navy/90">
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
  const tasks = useEhr(() => AdelanteEHR.getPatient(patientId)?.tasks ?? []);
  const open = tasks.filter((t) => !t.completedAt);
  if (open.length === 0) return null;
  return (
    <Card className="p-5 border-teal/40 bg-teal/5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Bell className="h-4 w-4" /> Things to do
      </div>
      <ul className="mt-3 space-y-2">
        {open.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm"
          >
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
                  AdelanteEHR.completeTask(patientId, t.id);
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

function MedRow({ med, patientId }: { med: Medication; patientId: string }) {
  const requests = useEhr(() =>
    AdelanteEHR.listRefillRequests({ patientId }).filter((r) => r.medicationId === med.id),
  );
  const latest = requests[0];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const submit = () => {
    const req = AdelanteEHR.requestRefill({
      patientId,
      medicationId: med.id,
      pharmacyNote: note.trim() || undefined,
      requestedBy: "patient",
    });
    if (req) {
      toast.success("Refill request sent to your care team");
      setOpen(false);
      setNote("");
    } else {
      toast.error("Could not send that request.");
    }
  };

  const statusBadge = latest
    ? latest.status === "pending"
      ? { label: "Refill pending", cls: "bg-gold/30 text-navy" }
      : latest.status === "sent_to_pharmacy" || latest.status === "approved"
        ? { label: "Refill approved", cls: "bg-success/20 text-success" }
        : { label: "Refill denied", cls: "bg-destructive/15 text-destructive" }
    : null;

  return (
    <li className="border-b last:border-0 pb-2 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-navy">
            {med.name} <span className="text-muted-foreground font-normal">· {med.dose}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {med.frequency} · {med.prescriber}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge ? (
            <Badge
              className={`${statusBadge.cls} border-0 text-[10px]`}
              title={latest?.denyReason ?? undefined}
            >
              {statusBadge.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              active
            </Badge>
          )}
          {(!latest || latest.status === "denied") && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 min-w-11 text-[11px]"
              onClick={() => setOpen((v) => !v)}
            >
              Request refill
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-2 rounded-md border bg-muted/30 p-2 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for your prescriber (optional) — e.g. pharmacy name, ran out early"
            className="min-h-[60px] text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11 text-[11px]"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="min-h-11 text-[11px] bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={submit}
            >
              Send request
            </Button>
          </div>
        </div>
      )}
      {latest?.denyReason && latest.status === "denied" && (
        <div className="mt-1 text-[10px] text-destructive">
          Prescriber note: {latest.denyReason}
        </div>
      )}
    </li>
  );
}

// §Messaging Phase 2 — "message your care team". One ongoing thread.
function MessagesCard({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const messages = useEhr(() => AdelanteEHR.listCareMessages(patientId));
  const unread = useEhr(() => AdelanteEHR.unreadCountForPatient(patientId));
  // Same consent field the Privacy & Consent card reads/writes.
  const part2Consent = useEhr(() => AdelanteEHR.getConsentState(patientId).part2Sud);
  const [draft, setDraft] = useState("");
  // Opt-in, unchecked by default — never an assumption about every message.
  const [sensitive, setSensitive] = useState(false);

  // Opening the card is the patient's "view" — clears their side only.
  useEffect(() => {
    if (unread > 0) AdelanteEHR.markMessagesReadByPatient(patientId);
  }, [patientId, unread]);

  const send = () => {
    // Sent verbatim: no trimming of content, no translation, no rewriting.
    const sent = AdelanteEHR.sendPatientMessage(patientId, draft, sensitive);
    if (sent) {
      setDraft("");
      setSensitive(false);
      toast.success(t("msgSent"));
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
          <MessageSquare className="h-4 w-4" /> {t("msgTitle")}
        </div>
        {unread > 0 && (
          <Badge className="border-0 bg-teal/20 text-teal text-[10px]">
            {unread} {t("msgNewReplies")}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("msgSubtitle")}</p>
      <div className="mt-3">
        <CareMessageThread
          messages={messages.slice(-8)}
          side="patient"
          emptyLabel={t("msgNoneYet")}
          youLabel={t("msgYou")}
          themLabel={t("msgCareTeam")}
        />
      </div>
      <div className="mt-3 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("msgPlaceholder")}
          className="min-h-[70px] text-sm"
        />
        {/* Persistent 988 notice directly above Send — safety boundary. */}
        <CrisisNotice />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={sensitive}
            onCheckedChange={(v) => setSensitive(v === true)}
            className="mt-0.5"
            aria-label={t("msgSensitive")}
          />
          <span>{t("msgSensitive")}</span>
        </label>
        {/* Transparency nudge — informational only, never blocks sending. */}
        {sensitive && !part2Consent && (
          <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground">
            {t("msgSensitiveConsentOff")}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            className="min-h-11 bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!draft.trim()}
            onClick={send}
          >
            {t("msgSend")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MyProfileCard({ patientId }: { patientId: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
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
            {channelLabel[patient.contactPrefs.channel]} ·{" "}
            {timeLabel[patient.contactPrefs.bestTime]}
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
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const notes = (patient?.notifications ?? []).filter((n) => n.apptId === apptId);
  if (notes.length === 0) return null;
  const note = notes[0];
  const verb =
    note.kind === "booked"
      ? "Booked"
      : note.kind === "rescheduled"
        ? "Rescheduled"
        : note.kind === "cancelled"
          ? "Cancelled"
          : "Confirmed";
  // Group latest state per channel across the batch tied to this event.
  const latestByChannel = new Map<string, typeof note>();
  for (const n of notes) {
    if (n.kind !== note.kind) continue;
    if (!latestByChannel.has(n.channel)) latestByChannel.set(n.channel, n);
  }
  const label = (c: string) => (c === "profile" ? "profile" : c === "sms" ? "text" : "email");
  const dot = (s: string) =>
    s === "delivered"
      ? "bg-teal"
      : s === "sent"
        ? "bg-amber-500"
        : s === "failed"
          ? "bg-destructive"
          : "bg-muted-foreground";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 text-teal">
        <CheckCircle2 className="h-3 w-3" />
        {verb}
      </span>
      {Array.from(latestByChannel.values()).map((n) => (
        <span
          key={n.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5"
          title={n.error ?? n.state}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot(n.state)}`} />
          {label(n.channel)} · {n.state}
        </span>
      ))}
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
  return <ConsentCardInner patientId={patientId} />;
}

function SupportPlanCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = (p?.sdohPlan?.items ?? []).filter((i) => i.visibleToPatient !== false);
  if (items.length === 0) return null;
  const statusLabel: Record<string, string> = {
    identified: "We noted this",
    sent: "Sent to partner",
    accepted: "Partner accepted",
    scheduled: "Scheduled",
    completed: "Done",
    not_completed: "Didn't happen",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <HeartPulse className="h-4 w-4" /> Your support plan
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Everyday needs your team is helping with.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="rounded-md border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-navy">{i.need}</span>
              <Badge variant="outline" className="text-[10px]">
                {statusLabel[i.status] ?? i.status}
              </Badge>
            </div>
            {i.note && <div className="text-xs text-muted-foreground mt-1">{i.note}</div>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReferralsForYouCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = (p?.resourceReferrals ?? []).filter((r) => r.visibleToPatient !== false);
  if (items.length === 0) return null;
  const statusLabel: Record<string, string> = {
    pending: "In progress",
    accepted: "Partner accepted",
    completed: "Done",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <HandHeart className="h-4 w-4" /> Referrals for you
      </div>
      <p className="text-xs text-muted-foreground mt-1">Places your team connected you with.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((r) => (
          <li key={r.id} className="rounded-md border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-navy capitalize">
                  {r.category} — {r.provider}
                </div>
                {r.note && <div className="text-xs text-muted-foreground mt-0.5">{r.note}</div>}
              </div>
              <Badge variant="outline" className="text-[10px]">
                {statusLabel[r.status] ?? r.status}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ConsentCardInner({ patientId }: { patientId: string }) {
  const consent = useEhr(() => AdelanteEHR.getConsentState(patientId));
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
                AdelanteEHR.setConsent(patientId, r.key, v);
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
