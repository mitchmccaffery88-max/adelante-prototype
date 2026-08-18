// §Patient portal Build 2 — the home dashboard, ported from the source shell.
//
// Structure is a faithful port; every value is REAL. Where the source
// references something this build does not have, the tile says so rather than
// inventing a stand-in — see the "Not built yet" chips and the gap list in the
// build notes. Nothing here changes a data model, a gate, or an access check:
// gated data is read through exactly the same call the detail surface uses.
import { useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  ClipboardCheck,
  ChevronRight,
  HandHeart,
  HeartPulse,
  LifeBuoy,
  Lock,
  MapPin,
  MessageSquare,
  Pill,
  Route as RouteIcon,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClientDate } from "@/components/ClientDate";
import { GetHelpNowModal } from "@/components/patient/GetHelpNowModal";
import { usePopulation } from "@/components/PopulationGate";
import { checkInStreakFrom } from "@/lib/checkInStreak";
import { privateNudge } from "@/lib/privateNudge";
import {
  completedLibraryItems,
  completedExercises,
  savedToolkitItems,
  subscribeEngagement,
} from "@/lib/engagement";
import { isLibraryItemVisible } from "@/lib/library";
import {
  liveLibraryItem,
  liveLibraryItems,
  usePublishedContentVersion,
} from "@/lib/contentCatalog";
import {
  patientVisibleResources,
  RESOURCE_CATEGORIES,
  subscribeResources,
} from "@/lib/communityResources";
import { listObligations, subscribeObligations } from "@/lib/obligations";
import {
  dailyCheckInDayKeys,
  listLapses,
  subscribeSelfTracking,
  todaysCheckIn,
} from "@/lib/selfTracking";
import {
  DAY_ZERO_STEPS,
  dayZeroAvailability,
  getDayZeroProgress,
  subscribeDayZero,
} from "@/lib/reentryDayZero";
import { ADHERENCE_TONE } from "@/lib/medAdherence";
import { marRowLabel } from "@/lib/mar";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------


// §P2 item 3 — patient-facing wording for the real SDOH / referral statuses.
const SDOH_STATUS_LABEL: Record<string, string> = {
  identified: "We noted this",
  sent: "Sent to partner",
  accepted: "Partner accepted",
  scheduled: "Scheduled",
  completed: "Done",
  not_completed: "Didn't happen",
};

const REFERRAL_STATUS_LABEL: Record<string, string> = {
  pending: "In progress",
  accepted: "Partner accepted",
  completed: "Done",
};

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function NotBuiltChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-2 inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Not built yet · {children}
    </span>
  );
}

function TileShell({
  icon: Icon,
  title,
  children,
  id,
}: {
  icon: typeof Pill;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Card className="flex flex-col p-5" id={id}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </div>
      <div className="mt-2 flex-1">{children}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function HomeDashboard({ patientId }: { patientId: string }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const population = usePopulation(patientId);

  // --- real per-day check-in sources (see src/lib/checkInStreak.ts) ---------
  const doseReports = useEhr(() => AdelanteEHR.listDoseSelfReports(patientId));
  const quickCheckDates = useEhr(() => AdelanteEHR.quickCheckDates(patientId));
  const doseRows = useEhr(() => AdelanteEHR.patientDoseChecklist(patientId));
  const appts = useEhr(() => AdelanteEHR.appointmentsForPatient(patientId));
  const messages = useEhr(() => AdelanteEHR.listCareMessages(patientId));
  const engagementKey = useSyncExternalStore(
    subscribeEngagement,
    () => JSON.stringify(savedToolkitItems(patientId).map((t) => t.createdAt)),
    () => "[]",
  );
  const lessonsDone = useMemo(() => completedLibraryItems(patientId), [patientId, engagementKey]);
  const exercisesDone = useMemo(
    () => completedExercises(patientId),
    [patientId, engagementKey],
  );
  const toolkit = useMemo(() => savedToolkitItems(patientId), [patientId, engagementKey]);
  const obligationsKey = useSyncExternalStore(
    subscribeObligations,
    () => JSON.stringify(listObligations(patientId).map((o) => [o.id, o.completed])),
    () => "[]",
  );
  const obligations = useMemo(
    () => listObligations(patientId),
    [patientId, obligationsKey],
  );
  const dayZeroKey = useSyncExternalStore(
    subscribeDayZero,
    () => JSON.stringify(getDayZeroProgress(patientId)?.completedSteps ?? []),
    () => "[]",
  );
  const dayZero = useMemo(() => getDayZeroProgress(patientId), [patientId, dayZeroKey]);
  const dayZeroOpen = useEhr(() => dayZeroAvailability(patientId));

  // §Tier 1 Build B — the daily mood check-in is a real third streak source.
  const selfTrackingKey = useSyncExternalStore(
    subscribeSelfTracking,
    () => `${dailyCheckInDayKeys(patientId).join(",")}|${listLapses(patientId).length}`,
    () => "",
  );
  const dailyKeys = useMemo(
    () => dailyCheckInDayKeys(patientId),
    [patientId, selfTrackingKey],
  );
  const checkedInTodayFlow = useMemo(
    () => Boolean(todaysCheckIn(patientId)),
    [patientId, selfTrackingKey],
  );

  const streak = useMemo(
    () =>
      checkInStreakFrom({
        doseSelfReportDates: doseReports.map((r) => r.facilityDate),
        quickCheckCompletedAt: quickCheckDates,
        dailyCheckInDayKeys: dailyKeys,
      }),
    [doseReports, quickCheckDates, dailyKeys],
  );

  const checkInDaysLast14 = useMemo(() => {
    const cutoff = Date.now() - 14 * 86_400_000;
    const keys = new Set<string>();
    for (const r of doseReports) {
      if (new Date(r.reportedAt).getTime() >= cutoff) keys.add(r.facilityDate);
    }
    for (const iso of quickCheckDates) {
      const d = new Date(iso);
      if (d.getTime() >= cutoff) keys.add(d.toISOString().slice(0, 10));
    }
    const cutoffKey = new Date(cutoff).toISOString().slice(0, 10);
    for (const k of dailyKeys) if (k >= cutoffKey) keys.add(k);
    return keys.size;
  }, [doseReports, quickCheckDates, dailyKeys]);

  const medsScheduledToday = doseRows.length;
  const medsUnmarkedToday = doseRows.filter((r) => !r.selfReport).length;

  // §P2 item 2 — real recency of the weekly PHQ-2/GAD-2 check, used for tile
  // prioritization. Same source the streak already reads.
  const daysSinceQuickCheck = useMemo(() => {
    const last = [...quickCheckDates].sort().pop();
    if (!last) return undefined;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  }, [quickCheckDates]);
  const weeklyCheckDue = daysSinceQuickCheck === undefined || daysSinceQuickCheck >= 7;
  const weeklyCheckOverdue = daysSinceQuickCheck !== undefined && daysSinceQuickCheck >= 10;

  // §P2 item 3 — real SDOH needs and referrals off the active care plan.
  const sdohItems = (patient?.sdohPlan?.items ?? []).filter((i) => i.visibleToPatient !== false);
  const referralItems = (patient?.resourceReferrals ?? []).filter(
    (r) => r.visibleToPatient !== false,
  );

  const daysSinceContact = useMemo(() => {
    const last = messages.map((m) => m.createdAt).sort().pop();
    if (!last) return undefined;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
  }, [messages]);

  const nudge = useMemo(
    () =>
      privateNudge({
        streakDays: streak.days,
        checkedInToday: streak.checkedInToday,
        medsUnmarkedToday,
        medsScheduledToday,
        openObligations: obligations.filter((o) => !o.completed).length,
        ...(daysSinceContact === undefined ? {} : { daysSinceContact }),
        checkInDaysLast14,
      }),
    [
      streak,
      medsUnmarkedToday,
      medsScheduledToday,
      obligations,
      daysSinceContact,
      checkInDaysLast14,
    ],
  );

  // --- "Today's forward step": the next unfinished, population-visible lesson
  const contentVersion = usePublishedContentVersion();
  const visibleLessons = useMemo(
    () =>
      liveLibraryItems()
        .filter((i) => isLibraryItemVisible(i, population))
        .slice()
        .sort((a, b) => a.order - b.order),
    [population, contentVersion],
  );
  const nextLesson = useMemo(
    () => visibleLessons.find((i) => !lessonsDone.includes(i.id)),
    [visibleLessons, lessonsDone],
  );
  // §Build A item 7 — a real completion percentage, over the lessons this
  // patient can actually see (population-filtered), not the whole catalogue.
  const lessonsDoneVisible = useMemo(
    () => visibleLessons.filter((i) => lessonsDone.includes(i.id)).length,
    [visibleLessons, lessonsDone],
  );
  const libraryPercent =
    visibleLessons.length > 0
      ? Math.round((lessonsDoneVisible / visibleLessons.length) * 100)
      : 0;
  const hasProgress = lessonsDoneVisible > 0 || exercisesDone.length > 0;

  const lastToolkit = useMemo(
    () => [...toolkit].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop(),
    [toolkit],
  );

  const nextAppt = useMemo(() => {
    const now = Date.now();
    return [...appts]
      .filter((a) => a.status === "scheduled" && new Date(a.start).getTime() > now)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  }, [appts]);

  const resourceKey = useSyncExternalStore(
    subscribeResources,
    () => String(patientVisibleResources().length),
    () => "0",
  );
  const liveCategories = useMemo(
    () => RESOURCE_CATEGORIES.filter((c) => patientVisibleResources(c.id).length > 0),
    [resourceKey],
  );

  if (!patient) return null;
  const firstName = patient.preferredName || patient.firstName;

  // §P2 item 2 — tiles carry a real priority derived from live state instead
  // of a fixed source order. Higher renders first; ties keep source order.
  // §Build A item 1 — the daily check-in used to render TWICE on /home: this
  // status tile plus the real `DailyCheckInCard` picker further down. The tile
  // is gone; the picker is the single rendering and now sits at the top of the
  // page (see PatientHome).
  const tiles: { key: string; priority: number; node: React.ReactNode }[] = [];
  tiles.push({
    key: "weekly-check-in",
    priority: weeklyCheckOverdue ? 88 : weeklyCheckDue ? 70 : 15,
    node: (
      <TileShell icon={ClipboardCheck} title="Weekly check">
        {weeklyCheckDue && (
          <Badge className="mb-2" variant="outline" data-testid="weekly-check-in-due">
            {weeklyCheckOverdue ? "Overdue" : "Due this week"}
          </Badge>
        )}
        <p className="text-sm text-muted-foreground">
          {daysSinceQuickCheck === undefined
            ? "The PHQ-2 / GAD-2 check — six questions, once a week."
            : `Last done ${daysSinceQuickCheck === 0 ? "today" : `${daysSinceQuickCheck} day${daysSinceQuickCheck === 1 ? "" : "s"} ago`}.`}
        </p>
        <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
          <Link to="/home" hash="daily-check-in">
            {weeklyCheckDue ? "Take this week's check" : "Open the weekly check"}
          </Link>
        </Button>
      </TileShell>
    ),
  });

  // Rough patch — craving tool and slip support, both patient-private
  tiles.push({
    key: "rough-patch",
    priority: 60,
    node: (
          <TileShell icon={Waves} title="A rough patch">
            <p className="text-sm text-muted-foreground">
              Two tools for the hard hours. Neither is shared with anyone.
            </p>
            <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
              <Link to="/craving">I&apos;m craving right now</Link>
            </Button>
            <Button asChild variant="outline" className="mt-2 min-h-11 w-full rounded-2xl">
              <Link to="/slip">I used — help me pick it back up</Link>
            </Button>
          </TileShell>
    ),
  });
  // Continue where you left off — polymorphic on real engagement data
  tiles.push({
    key: "pick-up",
    priority: 35,
    node: (
          <TileShell icon={BookOpen} title="Pick up where you left off">
            {hasProgress ? (
              <>
                <p className="text-base">{lastToolkit ? lastToolkit.label : "Keep going"}</p>
                <p className="mt-1 text-sm font-medium text-foreground" data-testid="library-progress-percent">
                  {libraryPercent}% of your lessons done
                </p>
                <Progress className="mt-2 h-2" value={libraryPercent} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {lessonsDone.length} lesson{lessonsDone.length === 1 ? "" : "s"} ·{" "}
                  {exercisesDone.length} tool{exercisesDone.length === 1 ? "" : "s"} finished
                </p>
                <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
                  {lastToolkit ? (
                    <Link
                    to="/library"
                    search={
                      lastToolkit.from === "exercise"
                        ? { exercise: lastToolkit.id }
                        : { item: lastToolkit.id }
                    }
                  >
                    {liveLibraryItem(lastToolkit.id) ? "Open the lesson" : "Open the tool"}
                    </Link>
                  ) : (
                    <Link to="/library">Back to the library</Link>
                  )}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nothing started yet. The library is a good first stop.
                </p>
                <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
                  <Link to="/library">Browse the library</Link>
                </Button>
              </>
            )}
          </TileShell>
    ),
  });
  // Resources near you
  tiles.push({
    key: "resources",
    priority: 30,
    node: (
          <TileShell icon={MapPin} title="Resources near you">
            {liveCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {liveCategories.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    to="/resources"
                    className="rounded-full border bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/70"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing verified in your area yet. Our team calls every listing before it shows up
                here.
              </p>
            )}
            <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
              <Link to="/resources">See all resources</Link>
            </Button>
          </TileShell>
    ),
  });
  // Upcoming appointment + prep tip
  tiles.push({
    key: "next-appointment",
    priority: 50,
    node: (
          <TileShell icon={Calendar} title="Next appointment">
            {nextAppt ? (
              <>
                <p className="text-base">
                  <ClientDate
                    value={nextAppt.start}
                    options={{
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }}
                  />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {AdelanteEHR.getClinician(nextAppt.clinicianId)?.name}
                  {nextAppt.modality === "phone"
                    ? " · by phone"
                    : nextAppt.modality === "in_person"
                      ? " · in person"
                      : " · video"}
                </p>
                <p className="mt-2 rounded-2xl bg-secondary p-3 text-sm">
                  {apptPrepTip(nextAppt.modality)}
                </p>
                <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
                  <Link to="/schedule">Manage appointments</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nothing scheduled right now.</p>
                <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
                  <Link to="/schedule">Book a time</Link>
                </Button>
              </>
            )}
          </TileShell>
    ),
  });
  // Today's medication — real Phase 7 self-report, not a new mechanism
  if (medsScheduledToday > 0)
    tiles.push({
    key: "medication",
    priority: 65,
    node: (
          <TileShell icon={Pill} title="Today's medication">
              <ul className="space-y-2">
                {doseRows.slice(0, 3).map((row) => {
                  const taken = row.selfReport?.status === "taken";
                  return (
                    <li
                      key={row.slot.key}
                      className="flex items-center justify-between gap-2 rounded-2xl border p-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {marRowLabel(row.slot.order)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {row.slot.timeLabel}
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={taken ? "secondary" : "outline"}
                        data-testid={`dashboard-mark-taken-${row.slot.key}`}
                        className="min-h-11 shrink-0 rounded-2xl"
                        onClick={() => {
                          AdelanteEHR.selfReportDose(patientId, {
                            orderId: row.slot.order.id,
                            scheduledAt: row.slot.scheduledAt,
                            facilityDate: row.slot.facilityDate,
                            status: taken ? "not_taken" : "taken",
                          });
                          toast.success(taken ? ADHERENCE_TONE.missedDay : "Marked as taken");
                        }}
                      >
                        {taken ? (
                          <>
                            <Check className="mr-1 h-4 w-4" /> Taken
                          </>
                        ) : (
                          "Mark taken"
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
                <Link to="/medications">
                  All my medicines
                </Link>
              </Button>
          </TileShell>
    ),
  });
  // Your journey — the source's 5-stage model has no equivalent here
  tiles.push({
    key: "journey",
    priority: 20,
    node: (
          <TileShell icon={RouteIcon} title="Your journey">
            <p className="text-sm text-muted-foreground">
              Your care plan and goals are the real picture of where you are.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              No stage model exists in this build, and we won't guess at one.
            </p>
            <NotBuiltChip>A 5-stage journey model needs clinical sign-off first</NotBuiltChip>
            <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
              <Link to="/home" hash="your-care-plan-heading">
                Open your care plan
              </Link>
            </Button>
          </TileShell>
    ),
  });

  // §P2 item 3 — real SDOH needs and referral status off the active care plan,
  // not a generic link to the resource library.
  if (sdohItems.length > 0 || referralItems.length > 0)
    tiles.push({
      key: "support-needs",
      priority: 75,
      node: (
        <TileShell icon={HandHeart} title="Your support needs">
          <p className="text-sm text-muted-foreground">
            What your care team is actively working on with you.
          </p>
          <ul className="mt-3 space-y-2" data-testid="sdoh-status-list">
            {sdohItems.slice(0, 3).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded-2xl border p-2.5">
                <span className="min-w-0 truncate text-sm">{i.need}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {SDOH_STATUS_LABEL[i.status] ?? i.status}
                </Badge>
              </li>
            ))}
            {referralItems.slice(0, 2).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl border p-2.5">
                <span className="min-w-0 truncate text-sm capitalize">
                  {r.category} — {r.provider}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {REFERRAL_STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-2xl">
            <Link to="/home" hash="your-care-plan-heading">
              See the full plan
            </Link>
          </Button>
        </TileShell>
      ),
    });

  tiles.sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-5" data-testid="patient-home-dashboard">
      {/* 1 — personalized header ------------------------------------------ */}
      <header>
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">
          {greeting(new Date())}, {firstName}.
        </h1>
        <p className="mt-1 text-base text-muted-foreground" data-testid="patient-streak-line">
          {streak.days > 0
            ? `${streak.days}-day check-in streak${streak.checkedInToday ? "" : " · today's still open"}`
            : "No check-in streak going right now — today can start one."}
        </p>
      </header>

      {/* 2 — private pattern nudge ------------------------------------------
          Rendered from a pure function with no store and no audit sink, so the
          privacy line below is literally true. Never persist this. */}
      {nudge && (
        <Card
          data-testid="private-nudge"
          className="border-accent/40 bg-accent/10 p-5 soft-shadow"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent/25 text-accent-foreground">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-base text-foreground">{nudge.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Just for you. Nobody else sees this — not your officer, not your case manager.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 3 — onboarding / reentry progress (justice-involved only) ---------- */}
      {dayZeroOpen.available && (
        <Card className="p-5" data-testid="reentry-progress-card">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <RouteIcon className="h-4 w-4" aria-hidden="true" /> Your first days back
          </div>
          <p className="mt-2 text-base">
            {(dayZero?.completedSteps.length ?? 0)} of {DAY_ZERO_STEPS.length} steps done
          </p>
          <Progress
            className="mt-2 h-2"
            value={((dayZero?.completedSteps.length ?? 0) / DAY_ZERO_STEPS.length) * 100}
          />
          <Button asChild variant="outline" className="mt-3 min-h-11 rounded-2xl">
            <Link to="/home" hash="day-zero">
              Pick up where you left off <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      )}

      {/* 5 — quick actions --------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          type="button"
          data-testid="get-help-now-button"
          onClick={() => setHelpOpen(true)}
          className="min-h-[64px] justify-start rounded-2xl bg-primary px-4 text-base text-primary-foreground hover:bg-primary/90"
        >
          <LifeBuoy className="mr-2 h-5 w-5" aria-hidden="true" /> Get help now
        </Button>

        <Link
          to="/home"
          hash="care-messages"
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border bg-card px-4 text-base font-medium soft-shadow hover:bg-secondary"
        >
          <HandHeart className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Peer specialist
            <span className="block text-xs font-normal text-muted-foreground">
              Through your care-team thread
            </span>
          </span>
        </Link>

        <Link
          to="/schedule"
          search={{ tab: "groups" }}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border bg-card px-4 text-base font-medium soft-shadow hover:bg-secondary"
        >
          <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Find a meeting
            <span className="block text-xs font-normal text-muted-foreground">
              Browse and join open group sessions
            </span>
          </span>
        </Link>
      </div>

      {/* 6 — Adel entry card -------------------------------------------------- */}
      <Card className="p-5" data-testid="adel-entry-card">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">What Can I Help You With Today?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Adel answers questions in your own words, any hour — and can hand you off to your
              care team when a person is what you need.
            </p>
            <Button asChild className="mt-3 min-h-11 rounded-2xl">
              <Link to="/adel">Ask Adel</Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* 7 — hero "Today's Forward Step" -------------------------------------- */}
      <Card
        data-testid="forward-step-card"
        className="border-0 bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground soft-shadow"
      >
        <div className="text-xs font-medium uppercase tracking-wider opacity-90">
          Today's forward step
        </div>
        {nextLesson ? (
          <>
            <h2 className="mt-2 font-display text-2xl">{nextLesson.title}</h2>
            <p className="mt-1 text-sm opacity-90">
              {nextLesson.problem} · about {nextLesson.minutes} min
            </p>
            <Button
              asChild
              className="mt-4 min-h-11 rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Link to="/library" search={{ item: nextLesson.id }}>
                Start it <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h2 className="mt-2 font-display text-2xl">You've finished every lesson open to you.</h2>
            <p className="mt-1 text-sm opacity-90">
              Your toolkit is yours to revisit any time.
            </p>
            <Button
              asChild
              className="mt-4 min-h-11 rounded-2xl bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Link to="/library">Open the library</Link>
            </Button>
          </>
        )}
      </Card>

      {/* 8 — main grid — ordered by live priority (see tiles above) --------- */}
      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((t) => (
          <div key={t.key} data-tile={t.key} className="contents">
            {t.node}
          </div>
        ))}
      </div>

      <GetHelpNowModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
