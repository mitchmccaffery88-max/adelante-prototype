import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  AdelanteEHR,
  defaultOccurrenceModality,
  isVirtualGroupModality,
  useEhr,
} from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Smartphone,
  Calendar as CalIcon,
  HeartPulse,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Bell,
} from "lucide-react";
import { Users, MessageSquare, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { ClientDate } from "@/components/ClientDate";
import { nextOccurrenceForGroup } from "@/lib/groupMetrics";
import { ReentryDayZeroModule } from "@/components/reentry/ReentryDayZeroModule";
import { ObligationsCard } from "@/components/reentry/ObligationsCard";
import { SafetyPlanSummaryTile } from "@/components/patient/SafetyPlanSummaryTile";
import { QuickCheckCard } from "@/components/clinical/QuickCheckCard";
import { AdvocateDesignationPanel } from "@/components/advocate/AdvocateDesignationPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { CarePlanCard } from "@/components/CarePlanCard";
import { EmptyState } from "@/components/EmptyState";
import { CrisisNotice } from "@/components/CrisisNotice";
import { CareMessageThread } from "@/components/messages/CareMessageThread";
import { InstallAppButton } from "@/components/InstallAppButton";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";
import { useEffect, useRef, useState } from "react";
import { REASSESS_COPY, rescreenName } from "@/lib/reassessmentCopy";
import { HRSN_DOMAIN_NAME, PHASE9A_COPY } from "@/lib/phase9aCopy";
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { HomeDashboard } from "@/components/patient/HomeDashboard";
import { AdvocateNoPatientPrompt } from "@/components/advocate/AdvocateNoPatientPrompt";
import { DailyCheckInSummaryCard } from "@/components/patient/DailyCheckInSummaryCard";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";

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
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  // §Group sessions — optional `?msg=` prefill for the care-team composer.
  const search = useSearch({ strict: false }) as { msg?: string };
  const messagePrefill = typeof search.msg === "string" ? search.msg : undefined;
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const smsOn = useEhr(() => AdelanteEHR.isSmsOn(currentId));

  // No record for the acting id (pre-intake front-door visitor, or a
  // runtime-created demo record dropped by a reload). Rendering `null` here
  // used to produce a silent blank page with no way forward.
  if (!patient) {
    return (
      <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        {/* §Advocate Build 2 — an advocate-only visitor landing here isn't a
            person without a record, they're on the wrong shell. Point them at
            /advocate instead of the generic sign-up empty state. */}
        <AdvocateNoPatientPrompt
          fallback={
            <EmptyState
              title="We don't have a record for you yet"
              description="Start with a few questions and we'll set up your care. If you already signed up, sign in again to pick up where you left off."
              action={{ label: "Get started", onClick: () => void navigate({ to: "/start" }) }}
            />
          }
        />
      </div>
    );
  }

  // First-time experience: intake not yet completed.
  if (!patient.intakeCompletedAt) {
    return (
      <>
        <FirstTimeWelcome firstName={patient.firstName} patientId={patient.id} />
        {/* Pre-release patients often arrive with screening already on file
            before they start intake — show what the team knows here too. */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-8">
          <PreReleaseKnownNeedsCard patientId={patient.id} />
        </div>
      </>
    );
  }

  // §P1 My Care de-clutter — the appointment and medication lists that used
  // to be derived here now live on /schedule and /medications.
  const remaining = Math.max(0, 90 - patient.episodeDay);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      {/* §Build A item 9 — ACTIONABLE FIRST. The greeting, the hero "Today's
          forward step" and the daily check-in are what a patient came here to
          do; the 90-day strip, the safety-plan banner and the weekly PHQ-2 /
          GAD-2 card are status, and status now sits below the doing. Nothing
          moved out of /home and no gate changed — only the order. */}
      <HomeDashboard
        patientId={patient.id}
        afterHeader={
          /* §Standalone route items — the full daily check-in flow now lives
             at /checkin; /home keeps ONE real entry point (status + streak)
             directly under the greeting. Still a single implementation. */
          <div id="daily-mood-check-in" className="scroll-mt-24">
            <DailyCheckInSummaryCard patientId={patient.id} />
          </div>
        }
      />

      <ReassessmentOrCompleteTile patientId={patient.id} />

      <Card className="p-5" data-testid="episode-progress-card">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {t("homeDayOf")} {patient.episodeDay} {t("homeOfPlan")} {remaining}{" "}
            {t("homeDaysRemain")}
          </div>
          {smsOn && (
            <Badge className="bg-gold/30 text-navy border-0 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> {t("homeSmsFallback")}
            </Badge>
          )}
        </div>
        <Progress value={(patient.episodeDay / 90) * 100} className="mt-3 h-2" />
      </Card>

      {/* Safety-critical, justice-involved tracks only; counts only, never
          plan text. Still above the informational cascade. */}
      <SafetyPlanSummaryTile patientId={patient.id} />

      <div id="daily-check-in" className="scroll-mt-24">
        <QuickCheckCard patientId={patient.id} />
      </div>

      <HomeScreenNudge />
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
        <p className="text-xs text-muted-foreground mt-1">{t("homeGoalsHelp")}</p>
        <div className="mt-4 divide-y divide-border/60 space-y-4 [&>*+*]:pt-4">
          <CarePlanCard patientId={patient.id} audience="patient" className="bg-card" />
          <SupportPlanCard patientId={patient.id} />
        </div>
      </section>

      <YourGroupsSection patientId={patient.id} />
      <TasksCard patientId={patient.id} />
      <MessagesCard patientId={patient.id} prefill={messagePrefill} />
      <AdvocateDesignationPanel
        patientId={patient.id}
        designatedBy={{ actor: "patient", name: `${patient.firstName} ${patient.lastName}` }}
      />
      {/* §Phase 6 — reentry Day-0: triggers off the real safety-net lookup only. */}
      <div id="day-zero" className="scroll-mt-24">
        <ReentryDayZeroModule patientId={patient.id} />
      </div>
      {/* §Phase 6 — Obligations; justice-involved populations only. */}
      <ObligationsCard patientId={patient.id} />
    </div>
  );
}

/** True when a saved intake draft exists for this patient (intake.tsx P5 key). */
function useIntakeDraft(patientId: string): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    try {
      setHas(Boolean(localStorage.getItem(`adelante.intake.${patientId}`)));
    } catch {
      setHas(false);
    }
  }, [patientId]);
  return has;
}

function FirstTimeWelcome({ firstName, patientId }: { firstName: string; patientId: string }) {
  const { t } = useI18n();
  const hasDraft = useIntakeDraft(patientId);
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
          {hasDraft ? t("homeContinueNote") : t("homeIntakeBlurb")}
        </p>

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
            {/* The patient already has a record here, so this opens intake for
                THIS record — never sign-up, which would create a new person. */}
            <Link to="/intake" data-testid="home-intake-cta">
              <ClipboardList className="mr-2 h-4 w-4" />
              {hasDraft ? t("homeContinueIntake") : t("homeStartIntake")}
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
                {t.screenerKey ? (
                  <Link to="/rescreen/$key" params={{ key: t.screenerKey }} data-testid="task-rescreen-start">
                    Start
                  </Link>
                ) : (
                  <Link to="/intake">Start</Link>
                )}
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

// §Messaging Phase 2 — "message your care team". One ongoing thread.
function MessagesCard({ patientId, prefill }: { patientId: string; prefill?: string }) {
  const { t } = useI18n();
  const messages = useEhr(() => AdelanteEHR.listCareMessages(patientId));
  const unread = useEhr(() => AdelanteEHR.unreadCountForPatient(patientId));
  // Same consent field the Privacy & Consent card reads/writes.
  const part2Consent = useEhr(() => AdelanteEHR.getConsentState(patientId).part2Sud);
  const [draft, setDraft] = useState(prefill ?? "");
  const cardRef = useRef<HTMLDivElement>(null);
  // Opt-in, unchecked by default — never an assumption about every message.
  const [sensitive, setSensitive] = useState(false);

  // Opening the card is the patient's "view" — clears their side only.
  useEffect(() => {
    if (unread > 0) AdelanteEHR.markMessagesReadByPatient(patientId);
  }, [patientId, unread]);

  // Arriving with a prefilled draft (e.g. from the Groups tab): put the
  // composer in view so the patient can see what is about to be sent.
  useEffect(() => {
    if (prefill) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [prefill]);

  const send = () => {
    // Sent verbatim: no trimming of content, no translation, no rewriting.
    const sent = AdelanteEHR.sendPatientMessage(patientId, draft, sensitive);
    if (sent) {
      // §Crisis detection — runs AFTER the message is committed and never
      // blocks or edits it. Same flagCrisis mechanism as every other source.
      scanTextForCrisis(patientId, sent.body, { surface: "a care-team message" });
      setDraft("");
      setSensitive(false);
      toast.success(t("msgSent"));
    }
  };

  return (
    <Card className="p-5" ref={cardRef} id="care-messages">
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
      {/* §Peer messaging — one thread, honest sender identity. There is no
          second peer-only channel: the existing care-team thread already IS
          the member's messaging surface, and splitting it would fragment
          crisis detection, unread state and the staff queue. `/peer` is a
          focused VIEW of this same thread, not another one. */}
      <p className="mt-1 text-xs text-muted-foreground">{t("msgPeerNote")}</p>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="mt-2 min-h-11 rounded-2xl"
        data-testid="peer-chat-entry"
      >
        <Link to="/peer">
          <HeartHandshake className="mr-1 h-4 w-4" aria-hidden="true" /> Talk with a peer specialist
        </Link>
      </Button>

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

// §Group sessions — patient-facing, read-only. Topic + next date ONLY: no
// attendance history, no roster of other members, no note content. Reuses
// groupsForPatient / nextGroupOccurrenceForPatient rather than recomputing.
function YourGroupsSection({ patientId }: { patientId: string }) {
  const groups = useEhr(() => AdelanteEHR.groupsForPatient(patientId));
  return (
    <section
      aria-labelledby="your-groups-heading"
      className="rounded-xl border-2 border-teal/30 bg-secondary/30 p-4 sm:p-5"
      data-testid="patient-your-groups"
    >
      <h2
        id="your-groups-heading"
        className="font-display text-lg text-navy flex items-center gap-2"
      >
        <Users className="h-5 w-5 text-teal" /> Your groups
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        Groups you take part in, and when they next meet.
      </p>
      {groups.length === 0 && (
        <p
          className="mt-4 rounded-lg border bg-card p-3 text-sm text-muted-foreground"
          data-testid="patient-your-groups-empty"
        >
          No groups scheduled right now. If a group would be a good fit, your care team will talk it
          through with you first.
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {groups.map((g) => {
          const nextForThis = nextOccurrenceForGroup(g.id);
          // §Phase 6b — join link, shown only when the next meeting is virtual.
          const virtual = nextForThis
            ? isVirtualGroupModality(AdelanteEHR.groupOccurrenceModality(g.id, nextForThis))
            : isVirtualGroupModality(defaultOccurrenceModality(g.modality));
          const room = virtual
            ? AdelanteEHR.groupJoinLink(g.id, nextForThis ?? undefined)
            : undefined;
          return (
            <li key={g.id} className="rounded-lg border bg-card p-3">
              <div className="text-sm font-medium text-navy">{g.topic}</div>
              {g.description && (
                <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
              )}
              <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                <CalIcon className="h-3.5 w-3.5 text-teal" />
                {nextForThis ? (
                  <>
                    Next: <ClientDate value={nextForThis} />
                  </>
                ) : (
                  <>Next meeting time to be confirmed.</>
                )}
              </div>
              {virtual && (
                <p className="mt-1.5 break-all text-xs text-muted-foreground">
                  {room ? (
                    <>
                      Join by video or phone:{" "}
                      <a
                        className="text-teal underline"
                        href={room.joinUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {room.joinUrl}
                      </a>
                    </>
                  ) : (
                    "This group meets online. Your care team will share the join link before it starts."
                  )}
                </p>
              )}
            </li>
          );
        })}

      </ul>
    </section>
  );
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

// §5d-4 — `ReferralsForYouCard` was removed here. It listed referrals with no
// indication of WHICH need each one served, competing with /next-steps. The
// need-paired thread on /next-steps replaces it; the dashboard's support-needs
// tile is the single summary and links to that detail page.


// §Phase 9b — the completed-intake tile. Becomes "Reassessment due" when the
// draft cadence or an open re-screen task says a questionnaire is due; each
// Start opens ONLY that questionnaire. "Update my answers" stays available.
function ReassessmentOrCompleteTile({ patientId }: { patientId: string }) {
  const { t, lang } = useI18n();
  const L = lang === "es" ? "es" : "en";
  const c = REASSESS_COPY[L];
  const dueJson = useEhr(() => JSON.stringify(AdelanteEHR.patientReassessmentDue(patientId)));
  const due = JSON.parse(dueJson) as { key: string }[];
  if (due.length === 0) {
    return (
      <Card
        className="p-4 flex flex-wrap items-center justify-between gap-3"
        data-testid="intake-complete-tile"
      >
        <div className="flex items-start gap-2">
          <ClipboardList className="h-5 w-5 text-teal mt-0.5" />
          <div>
            <div className="font-medium text-navy">{t("homeIntakeDoneTitle")}</div>
            <div className="text-xs text-muted-foreground">{t("homeIntakeDoneBody")}</div>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/intake">{t("homeUpdateAnswers")}</Link>
        </Button>
      </Card>
    );
  }
  return (
    <Card className="p-4 space-y-3 border-teal/40 bg-teal/5" data-testid="reassessment-due-tile">
      <div className="flex items-start gap-2">
        <ClipboardList className="h-5 w-5 text-teal mt-0.5" />
        <div>
          <div className="font-medium text-navy">{c.tileTitle}</div>
          <div className="text-xs text-muted-foreground">{c.tileBody}</div>
        </div>
      </div>
      <ul className="space-y-2">
        {due.map((d) => (
          <li key={d.key} className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
            <span className="flex-1">{rescreenName(d.key, L)}</span>
            <Button asChild size="sm">
              <Link to="/rescreen/$key" params={{ key: d.key }} data-testid={`reassess-start-${d.key}`}>
                {c.start}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
      <Button asChild size="sm" variant="outline">
        <Link to="/intake">{t("homeUpdateAnswers")}</Link>
      </Button>
    </Card>
  );
}

// §Phase 9a — partner-reported pre-release HRSN needs, read-only. Interpersonal
// safety is staff-only and never listed; a domain whose plan item is marked
// not visible to the patient is also withheld.
function PreReleaseKnownNeedsCard({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const L = lang === "es" ? "es" : "en";
  const c = PHASE9A_COPY[L];
  const keysJson = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    const r = p?.screeners?.["ahc-hrsn"];
    if (!r || r.context !== "pre_release") return "[]";
    const hidden = (p?.sdohPlan?.items ?? []).filter((i) => i.visibleToPatient === false);
    const keys = (r.domains ?? [])
      .filter((d) => d.positive && d.key !== "safety" && HRSN_DOMAIN_NAME.en[d.key])
      .filter((d) => !hidden.some((i) => i.need.trim().toLowerCase() === d.label.trim().toLowerCase()))
      .map((d) => d.key);
    return JSON.stringify(keys);
  });
  const keys = JSON.parse(keysJson) as string[];
  if (keys.length === 0) return null;
  return (
    <Card className="p-4 space-y-2" data-testid="prerelease-known-needs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-navy">{c.knownTitle}</div>
        <Badge variant="outline" className="text-xs">{c.knownBadge}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{c.knownBody}</p>
      <ul className="flex flex-wrap gap-2">
        {keys.map((k) => (
          <li key={k} className="rounded-full border bg-secondary/40 px-3 py-1 text-sm">
            {HRSN_DOMAIN_NAME[L][k]}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{c.knownFooter}</p>
    </Card>
  );
}
