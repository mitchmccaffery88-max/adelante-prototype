import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";
import { CoverageExtras } from "@/components/chart/CoverageExtras";
import { RecordSafetyBadges } from "@/components/clinical/RecordSafetyBadges";
import { DemographicsCard } from "@/components/clinical/DemographicsCard";
import { PatientVisitsCard } from "@/components/scheduling/VisitActions";
import { AppointmentRequestsCard } from "@/components/scheduling/AppointmentRequestsCard";
// §Clinical record — single source of truth for chart sections.
// Both the quick-peek drawer and the full-page chart derive their navigation,
// gating and content from this registry, so neither can drift from the other.
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Home,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MapPin,
  MessageSquare,
  Pill,
  Repeat2,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Syringe,
  Stethoscope,
  Timer,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff, canAccess, type RecordClass } from "@/lib/roles";
import { recordSectionVisible } from "@/lib/recordSectionGate";
import { sectionHasAction } from "@/lib/chartActions";
import { inFacilityEnabled } from "@/lib/inFacility";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { ChartDocumentsList } from "@/components/chart/ChartDocumentsList";
import { useI18n } from "@/lib/i18n";
import { isReferralOpen } from "@/lib/noteAutofill";
import { ProblemsTab, AllergiesTab, AlertsTab } from "@/components/clinical/ClinicalRecordTabs";
import { CalomsProfileCard } from "@/components/clinical/CalomsProfileCard";
import { OrdersTab } from "@/components/clinical/OrdersTab";
import { MarTab } from "@/components/clinical/MarTab";
import { MedReconTab } from "@/components/clinical/MedReconTab";
import { OutsideRecordsPanel, HieTimelineStrip } from "@/components/hie/OutsideRecords";
import { ProtocolsTab } from "@/components/clinical/ProtocolsTab";
import { BookingsTab, HousingMovesTab } from "@/components/clinical/CustodyTabs";
import { ReentryHandoffTab } from "@/components/clinical/ReentryHandoffTab";
import { SafetyPlanPanel } from "@/components/clinical/SafetyPlanPanel";
import { CareEpisodesPanel } from "@/components/clinical/CareEpisodesPanel";
import { AsamPanel } from "@/components/clinical/AsamPanel";
import { StaffMessagesTab } from "@/components/messages/StaffMessagesTab";
import { StaffAdvocatesTab } from "@/components/advocate/StaffAdvocatesTab";
import {
  OverviewTab,
  ContactTab,
  CheckInsTab,
  SdohTab,
  ReferralsTab,
  EligibilityTab,
  CoordinationTab,
  TasksTab,
  ProviderHistoryTab,
  CarePlanTab,
  NotesTab,
  TrackingTab,
  PeerNotesTab,
  LockedNote,
} from "@/components/clinical/RecordTabs";

export type RecordSectionGroup = "chart" | "case" | "coordination";

export interface RecordSection {
  id: string;
  label: string;
  icon: LucideIcon;
  group: RecordSectionGroup;
  /** Inline count badge, when the section has a meaningful one. */
  count?: number;
  /** Emphasis for the count badge (severe allergy / critical alert). */
  urgent?: boolean;
  render: () => ReactNode;
}

/** Old section ids that were merged into another section. */
import { SECTION_ALIASES } from "@/lib/chartSectionAliases";
export { SECTION_ALIASES };
export const resolveSectionId = (id?: string) => (id ? (SECTION_ALIASES[id] ?? id) : id);

export const GROUP_LABELS: Record<RecordSectionGroup, string> = {
  chart: "Chart",
  case: "Case management",
  coordination: "Coordination",
};

/**
 * Safety counts shown in the header badge row. The sidebar reuses these exact
 * numbers rather than recomputing them.
 */
export function safetyCounts(patient: Patient) {
  const snapshot = patient.carePlan;
  const activeProblems = snapshot?.activeProblems ?? [];
  const hiddenSud = snapshot?.hiddenSudProblems ?? 0;
  const allergyEntries = (snapshot?.allergySummary ?? []) as {
    substance: string;
    severity: string;
  }[];
  const activeAlerts = (patient.alerts ?? []).filter((a) => !a.removedAt);
  return {
    activeProblems,
    activeProblemsCount: activeProblems.length,
    hiddenSud,
    allergyEntries,
    severeAllergy: allergyEntries.some((a) => a.severity === "severe"),
    activeAlerts,
    criticalAlert: activeAlerts.some((a) => a.severity === "critical"),
  };
}

/**
 * Gated section list for the acting role. A section the role cannot access is
 * omitted entirely — same rule the drawer's tab list has always used.
 */
export function useRecordSections(
  patient: Patient,
  opts: { initialNoteTemplateKey?: string } = {},
): RecordSection[] {
  const { role, staffId, clinicianId } = useActingStaff();
  const { t } = useI18n();
  const counts = useEhr(() => {
    const fresh = AdelanteEHR.getPatient(patient.id) ?? patient;
    const s = safetyCounts(fresh);
    return {
      problems: s.activeProblemsCount,
      allergies: s.allergyEntries.length,
      alerts: s.activeAlerts.length,
      severeAllergy: s.severeAllergy,
      criticalAlert: s.criticalAlert,
      tasks: (fresh.tasks ?? []).filter((t) => !t.completedAt).length,
      referrals: (fresh.resourceReferrals ?? []).filter((r) => isReferralOpen(r)).length,
      sdoh: (fresh.sdohPlan?.items ?? []).filter((i) => i.status !== "completed").length,
      bookings: (fresh.bookings ?? []).length,
      currentlyBooked: AdelanteEHR.isCurrentlyBooked(fresh.id),
      housingMoves: (fresh.housingMoves ?? []).length,
      unreadMessages: AdelanteEHR.unreadCountForStaff(fresh.id),
      unreviewedRecon: (() => {
        const open = AdelanteEHR.activeMedReconciliation(fresh.id);
        return open ? AdelanteEHR.unreviewedReconItems(fresh.id, open.id).length : 0;
      })(),
      activeProtocols: AdelanteEHR.listProtocolInstances(fresh.id).filter(
        (p) => p.status === "active",
      ).length,
    };
  });

  const gate = (cls: RecordClass) => canAccess(role, cls, patient);
  const actor = { role, staffId, clinicianId };
  const anyView = (...cls: RecordClass[]) =>
    cls.some((c) => {
      const a = gate(c);
      return a.level !== "none" && !a.locked;
    });
  const pid = patient.id;
  const sections: RecordSection[] = [];

  const add = (
    cls: RecordClass,
    def: Omit<RecordSection, "render"> & {
      render: (access: ReturnType<typeof gate>) => ReactNode;
      /** Sections that are always listed (never hidden), matching today's tabs. */
      alwaysVisible?: boolean;
    },
  ) => {
    // §Chart redesign — a section appears only if the role can view its data
    // OR act in it (chart action registry). No more locked stubs.
    const access = gate(cls);
    const canView = recordSectionVisible(cls, access) && !access.locked;
    const canAct = sectionHasAction(def.id, actor, patient);
    if (!def.alwaysVisible && !canView && !canAct) return;
    const { render, alwaysVisible: _av, ...rest } = def;
    sections.push({
      ...rest,
      render: () =>
        !canView && !canAct && access.locked ? <LockedNote reason={access.reason} /> : render(access),
    });
  };

  // ----- Chart -----
  add("demographics", {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "chart",
    render: () => (
      <>
        <ReferralStatusTimeline patient={patient} />
        <RecordSafetyBadges patient={patient} />
        <DemographicsCard patientId={pid} />
        <OverviewTab patientId={pid} />
        <HieTimelineStrip patientId={pid} />
      </>
    ),
  });
  // §Chart redesign turn 5 — uploaded documents (Part 2 docs hidden for restricted roles).
  add("documents", {
    id: "documents",
    label: "Documents",
    icon: FileText,
    group: "chart",
    render: () => <ChartDocumentsList patientId={pid} />,
  });
  // §HIE — simulated outside records; SUD rows Part 2-gated inside the panel.
  add("demographics", {
    id: "outside-records",
    label: "Outside records (HIE)",
    icon: Repeat2,
    group: "chart",
    render: () => <OutsideRecordsPanel patientId={pid} />,
  });
  add("problems", {
    id: "problems",
    label: "Problems",
    icon: HeartPulse,
    group: "chart",
    count: counts.problems,
    render: () => <ProblemsTab patientId={pid} />,
  });
  add("allergies", {
    id: "allergies",
    label: "Allergies",
    icon: ShieldAlert,
    group: "chart",
    count: counts.allergies,
    urgent: counts.severeAllergy,
    render: () => <AllergiesTab patientId={pid} />,
  });
  add("alerts", {
    id: "alerts",
    label: "Alerts",
    icon: Bell,
    group: "chart",
    count: counts.alerts,
    urgent: counts.criticalAlert,
    render: () => <AlertsTab patientId={pid} />,
  });
  add("care_plan", {
    id: "care-plan",
    label: "Care plan",
    icon: ClipboardCheck,
    group: "chart",
    render: (a) => <CarePlanTab patientId={pid} readOnly={a.level === "read"} />,
  });
  // §Reporting Tier 2 — structured CalOMS history. Gated by `sud_treatment`,
  // not `demographics`: substance-use and prior-treatment detail is 42 CFR
  // Part 2 content, so it inherits the same gate as the rest of the SUD record
  // even though the discharge and justice blocks are less sensitive.
  // §Part 2 — same check as the ASAM section: hidden (menu + ?section= URL)
  // for any role failing roleSeesAsamSection.
  if (roleSeesAsamSection(role, patient)) add("sud_treatment", {
    id: "caloms",
    label: "CalOMS (SUD data reporting)",
    icon: ListChecks,
    group: "chart",
    render: (a) => <CalomsProfileCard patientId={pid} readOnly={a.level !== "write"} />,
  });
  // §B3/B4 — outpatient episodes + higher-level referrals. SUD rows are
  // masked inside the panel ("Active in Adelante care").
  // §Phase 7 — patient-authored safety plan. Clinical-adjacent, so it lives in
  // the Chart group next to Alerts (where crisis work already happens), gated
  // by its own `safety_plan` class rather than therapy_notes.
  add("safety_plan", {
    id: "safety-plan",
    label: "Safety plan",
    icon: LifeBuoy,
    group: "chart",
    render: (a) => (
      <SafetyPlanPanel
        patientId={pid}
        readOnly={a.level !== "write"}
        author={`${role} (staff)`}
        actorRole={role}
      />
    ),
  });
  add("therapy_notes", {
    id: "notes",
    label: "Notes",
    icon: FileText,
    group: "chart",
    render: (a) => (
      <NotesTab
        patientId={pid}
        readOnly={a.level !== "write"}
        initialTemplateKey={opts.initialNoteTemplateKey}
      />
    ),
  });
  add("screeners_mh", {
    id: "tracking",
    label: "Tracking",
    icon: TrendingUp,
    group: "chart",
    render: () => <TrackingTab patientId={pid} />,
  });
  // §Phase 10c — ASAM. Part 2 protected: gated by `screeners_sud`, so
  // advocates and Part 2-restricted staff never see the section at all.
  if (roleSeesAsamSection(role, patient)) add("screeners_sud", {
    id: "asam",
    label: "ASAM",
    icon: ClipboardCheck,
    group: "chart",
    count: (patient.asamAssessments ?? []).length,
    render: () => <AsamPanel patient={patient} />,
  });
  add("meds_erx", {
    id: "orders",
    label: "Orders",
    icon: Pill,
    group: "chart",
    render: (a) => <OrdersTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  // MAR is patient-scoped by design (a tab in this record), NOT the reference
  // EMR's facility-wide MedPass roster — see src/lib/mar.ts.
  add("meds_erx", {
    id: "mar",
    label: "MAR",
    icon: Syringe,
    group: "chart",
    render: (a) => <MarTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  // Reconciliation sits next to Orders because it reads and closes orders.
  add("meds_erx", {
    id: "med-recon",
    label: "Med reconciliation",
    icon: Repeat2,
    group: "chart",
    count: counts.unreviewedRecon || undefined,
    urgent: counts.unreviewedRecon > 0,
    render: (a) => <MedReconTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  // §Worklist Phase B — protocol rounds sit in the Chart group next to MAR:
  // this is repeated scored clinical monitoring, not case-management work,
  // even though the rows it produces are worklist tasks. Gated on `worklist`
  // (the class the rounds themselves live under) so every role that can see
  // the tasks can see where they came from; STARTING/STOPPING is separately
  // restricted by `canManageProtocol`.
  add("worklist", {
    id: "protocols",
    label: "Protocols",
    icon: Timer,
    group: "chart",
    count: counts.activeProtocols || undefined,
    render: (a) => <ProtocolsTab patientId={pid} readOnly={a.level !== "write"} />,
  });

  // ----- Case management -----
  add("demographics", {
    id: "contact",
    label: "Contact info",
    icon: UserRound,
    group: "case",
    render: (a) => <ContactTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("case_notes", {
    id: "checkins",
    label: "Check-ins",
    icon: CalendarCheck,
    group: "case",
    render: (a) => <CheckInsTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("sdoh", {
    id: "sdoh",
    label: "SDOH",
    icon: Home,
    group: "case",
    count: counts.sdoh,
    render: (a) => <SdohTab patientId={pid} readOnly={a.level === "read"} />,
  });
  // §Chart redesign — one "Episodes & referrals" section: outpatient
  // episodes + higher-level referrals (B3/B4) and SDOH/resource referrals.
  if (anyView("therapy_notes", "sdoh") || sectionHasAction("episodes", actor, patient)) {
    const episodesView = anyView("therapy_notes") || sectionHasAction("episodes", actor, patient);
    const referralsAccess = gate("sdoh");
    sections.push({
      id: "episodes",
      label: "Episodes & referrals",
      icon: RouteIcon,
      group: "case",
      count: counts.referrals,
      render: () => (
        <div className="space-y-6">
          {episodesView && <CareEpisodesPanel patientId={pid} />}
          {referralsAccess.level !== "none" && !referralsAccess.locked && (
            <ReferralsTab
              patientId={pid}
              sudGated={gate("sud_treatment").locked}
              readOnly={referralsAccess.level === "read"}
            />
          )}
        </div>
      ),
    });
  }
  add("eligibility", {
    id: "eligibility",
    label: "Eligibility",
    icon: ClipboardCheck,
    group: "case",
    render: (a) => (
      <>
        <EligibilityTab patientId={pid} readOnly={a.level === "read"} />
        <CoverageExtras patientId={pid} />
      </>
    ),
  });
  // §Advocate build 1 — advocate connections are consent instruments, so they
  // ride the consent-ledger class: ECM Provider and Administrator write (the
  // two invite actors this build adds), clinical roles read.
  add("consent_ledger", {
    id: "advocates",
    label: "Advocates",
    icon: ShieldCheck,
    group: "case",
    render: (a) => <StaffAdvocatesTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("case_notes", {
    id: "tasks",
    label: "Tasks",
    icon: ListChecks,
    group: "case",
    count: counts.tasks,
    render: () => <TasksTab patientId={pid} readOnly={gate("case_notes").level === "read"} />,
  });
  // §Chart redesign — visits and appointment requests get their own section.
  if (anyView("case_notes", "care_coordination", "therapy_notes") || sectionHasAction("appointments", actor, patient))
    sections.push({
      id: "appointments",
      label: "Appointments",
      icon: CalendarCheck,
      group: "case",
      render: () => (
        <div className="space-y-4">
          <AppointmentRequestsCard patientId={pid} />
          <PatientVisitsCard patientId={pid} />
        </div>
      ),
    });
  add("peer_notes", {
    id: "peer",
    label: t("recPeerNotes"),
    icon: Users,
    group: "case",
    render: (a) => <PeerNotesTab patientId={pid} canWrite={a.level === "write"} />,
  });
  // §Phase 3 — CHW service notes. Reuses the note/template engine, scoped to
  // the CHW template so a CHW-only role never sees other documentation.
  add("chw_notes", {
    id: "chw",
    label: t("recChwNotes"),
    icon: Users,
    group: "case",
    render: (a) => (
      <NotesTab
        patientId={pid}
        readOnly={a.level !== "write"}
        restrictToTemplateKey="chw_service"
      />
    ),
  });

  // ----- Coordination -----
  // §Chart redesign — "External" + "Providers" merged into one section.
  if (anyView("case_notes", "care_coordination"))
    sections.push({
      id: "coord",
      label: "Outside providers",
      icon: Building2,
      group: "coordination",
      render: () => (
        <div className="space-y-6">
          {anyView("case_notes") && (
            <CoordinationTab patientId={pid} part2Consent={patient.consents.part2Sud} />
          )}
          {anyView("care_coordination") && <ProviderHistoryTab patientId={pid} />}
        </div>
      ),
    });
  // §Messaging Phase 2 — Coordination group: this is a communication channel
  // with the patient, not clinical charting, and it sits next to the other
  // "who is talking to whom" surfaces (External, Providers).
  add("patient_messaging", {
    id: "messages",
    label: "Messages",
    icon: MessageSquare,
    group: "coordination",
    count: counts.unreadMessages || undefined,
    urgent: counts.unreadMessages > 0,
    render: (a) => <StaffMessagesTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  // §Custody tracking — in-facility content, behind the off-by-default flag.
  if (inFacilityEnabled()) add("custody_tracking", {
    id: "bookings",
    // Custody (jail) bookings — distinct from visit Appointments.
    label: "Custody bookings",
    icon: KeyRound,
    group: "coordination",
    count: counts.bookings,
    urgent: counts.currentlyBooked,
    render: (a) => <BookingsTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  if (inFacilityEnabled()) add("custody_tracking", {
    id: "housing-moves",
    label: "Housing moves",
    icon: MapPin,
    group: "coordination",
    count: counts.housingMoves,
    render: (a) => <HousingMovesTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  // §v3.0 Phase 2 — the D0 intake read of the pre-release hand-off. Gated on
  // `care_coordination` (both the CF Care Manager and the receiving ECM
  // Provider hold it) rather than custody_tracking: the plan is coordination
  // data that outlives the custody episode.
  add("care_coordination", {
    id: "reentry-handoff",
    label: "Reentry hand-off",
    icon: Stethoscope,
    group: "coordination",
    render: () => <ReentryHandoffTab patientId={pid} />,
  });

  return sections;
}

export { AlertTriangle };
