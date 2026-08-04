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
  ListChecks,
  MapPin,
  MessageSquare,
  Pill,
  Repeat2,
  Route as RouteIcon,
  ShieldAlert,
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
import { ProblemsTab, AllergiesTab, AlertsTab } from "@/components/clinical/ClinicalRecordTabs";
import { OrdersTab } from "@/components/clinical/OrdersTab";
import { MarTab } from "@/components/clinical/MarTab";
import { MedReconTab } from "@/components/clinical/MedReconTab";
import { ProtocolsTab } from "@/components/clinical/ProtocolsTab";
import { BookingsTab, HousingMovesTab } from "@/components/clinical/CustodyTabs";
import { StaffMessagesTab } from "@/components/messages/StaffMessagesTab";
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
  const { role } = useActingStaff();
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
      referrals: (fresh.resourceReferrals ?? []).filter((r) => r.status !== "completed").length,
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
    const access = gate(cls);
    if (!def.alwaysVisible && access.level === "none") return;
    const { render, alwaysVisible: _av, ...rest } = def;
    sections.push({
      ...rest,
      render: () => (access.locked ? <LockedNote reason={access.reason} /> : render(access)),
    });
  };

  // ----- Chart -----
  add("demographics", {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "chart",
    alwaysVisible: true,
    render: () => <OverviewTab patientId={pid} />,
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
    label: "Contact",
    icon: UserRound,
    group: "case",
    alwaysVisible: true,
    render: (a) => <ContactTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("case_notes", {
    id: "checkins",
    label: "Check-ins",
    icon: CalendarCheck,
    group: "case",
    alwaysVisible: true,
    render: (a) => <CheckInsTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("sdoh", {
    id: "sdoh",
    label: "SDOH",
    icon: Home,
    group: "case",
    alwaysVisible: true,
    count: counts.sdoh,
    render: (a) => <SdohTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("sdoh", {
    id: "referrals",
    label: "Referrals",
    icon: RouteIcon,
    group: "case",
    alwaysVisible: true,
    count: counts.referrals,
    render: (a) => (
      <ReferralsTab
        patientId={pid}
        sudGated={gate("sud_treatment").locked}
        readOnly={a.level === "read"}
      />
    ),
  });
  add("eligibility", {
    id: "eligibility",
    label: "Eligibility",
    icon: ClipboardCheck,
    group: "case",
    alwaysVisible: true,
    render: (a) => <EligibilityTab patientId={pid} readOnly={a.level === "read"} />,
  });
  add("case_notes", {
    id: "tasks",
    label: "Tasks",
    icon: ListChecks,
    group: "case",
    alwaysVisible: true,
    count: counts.tasks,
    render: () => <TasksTab patientId={pid} readOnly={gate("case_notes").level === "read"} />,
  });
  add("peer_notes", {
    id: "peer",
    label: "Peer notes",
    icon: Users,
    group: "case",
    render: (a) => <PeerNotesTab patientId={pid} canWrite={a.level === "write"} />,
  });

  // ----- Coordination -----
  add("case_notes", {
    id: "coord",
    label: "External",
    icon: Building2,
    group: "coordination",
    alwaysVisible: true,
    render: () => <CoordinationTab patientId={pid} part2Consent={patient.consents.part2Sud} />,
  });
  add("care_coordination", {
    id: "providers",
    label: "Providers",
    icon: Stethoscope,
    group: "coordination",
    alwaysVisible: true,
    render: () => <ProviderHistoryTab patientId={pid} />,
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
  // §Custody tracking — coordination data, not clinical charting.
  add("custody_tracking", {
    id: "bookings",
    label: "Bookings",
    icon: KeyRound,
    group: "coordination",
    count: counts.bookings,
    urgent: counts.currentlyBooked,
    render: (a) => <BookingsTab patientId={pid} readOnly={a.level !== "write"} />,
  });
  add("custody_tracking", {
    id: "housing-moves",
    label: "Housing moves",
    icon: MapPin,
    group: "coordination",
    count: counts.housingMoves,
    render: (a) => <HousingMovesTab patientId={pid} readOnly={a.level !== "write"} />,
  });

  return sections;
}

export { AlertTriangle };
