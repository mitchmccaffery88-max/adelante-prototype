// §Platform nav — RBAC-driven navigation registry (Phase 1).
//
// This is the cross-patient sibling of `recordSections.tsx`: one registry, one
// gate model, and entries a role cannot access are OMITTED rather than
// disabled. It deliberately does NOT define who may see what — every entry
// points at a `RecordClass` that already exists in the roles matrix, so adding
// a role or changing a permission is a matrix edit, never a nav edit.
import {
  Building2,
  Calendar,
  Heart,
  CalendarClock,
  ClipboardList,
  ClipboardSignature,
  FileInput,
  FileSearch,
  FileStack,
  Gauge,
  HandHeart,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Pill,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  Siren,
  Stethoscope,
  Target,
  UserCog,
  UserSearch,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canAccess, useActingStaff, type AccessLevel, type RecordClass, type StaffRole } from "./roles";

export type NavGroup =
  | "care"
  | "queues"
  | "population"
  | "facility"
  | "revenue"
  | "administration"
  | "account";

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  care: "Care",
  queues: "Queues",
  population: "Population health",
  facility: "Facility & Custody",
  revenue: "Revenue & consent",
  administration: "Administration",
  account: "My account",
};

export const NAV_GROUP_ORDER: NavGroup[] = [
  "care",
  "queues",
  "population",
  "facility",
  "revenue",
  "administration",
  "account",
];

/**
 * How an entry is gated.
 *  - `record_class`: reuse the existing RBAC matrix. `anyOf` passes when the
 *    role clears ANY listed class (a surface can be reachable through more
 *    than one legitimate responsibility), at or above `minLevel`.
 *  - `open`: no PHI and no existing gate in the matrix (personal settings,
 *    provider-credential and vendor-status ops screens). Preserves today's
 *    behaviour without inventing a second permission system; when one of
 *    these earns a RecordClass, switch the gate here and nothing else changes.
 */
export type NavGate =
  | { kind: "record_class"; anyOf: RecordClass[]; minLevel?: Exclude<AccessLevel, "none"> }
  | { kind: "open" };

export interface NavEntry {
  id: string;
  label: string;
  /** Short "what is this" line, shown in the dropdown and sidebar tooltips. */
  desc: string;
  icon: LucideIcon;
  /** Route path exactly as registered in src/routes. */
  to: string;
  /**
   * Optional search params applied when the entry is a *pre-filtered view* of
   * an existing page rather than a page of its own (§Facility & Custody:
   * "Facility protocols" is the Worklist filtered to facility-context
   * protocol rounds — we filter into the Worklist, we don't clone its UI).
   */
  search?: Record<string, string>;
  group: NavGroup;
  gate: NavGate;
}

const LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  summary: 1,
  read: 2,
  consent_gated: 2,
  write: 3,
};

/** The full registry — every staff-facing surface in the app, gated. */
export const STAFF_NAV: NavEntry[] = [
  // ----- Care -----
  {
    id: "referral",
    label: "Referrals",
    desc: "Refer a client",
    icon: FileInput,
    to: "/referral",
    group: "care",
    gate: { kind: "record_class", anyOf: ["care_coordination"] },
  },
  {
    id: "case-manager",
    label: "ECM Provider",
    desc: "Check-ins & resources",
    icon: HandHeart,
    to: "/case-manager",
    group: "care",
    gate: { kind: "record_class", anyOf: ["case_notes", "peer_notes"] },
  },
  {
    id: "clinician",
    label: "Clinician",
    desc: "Caseload & sessions",
    icon: Stethoscope,
    to: "/clinician",
    group: "care",
    gate: { kind: "record_class", anyOf: ["therapy_notes", "psych_eval"] },
  },
  {
    id: "shift-count",
    label: "Shift count",
    desc: "Controlled-substance counts",
    icon: Pill,
    to: "/shift-count",
    group: "care",
    // §Facility & Custody reorg — physical stock custody, not e-prescribing.
    // Stays in Care because outpatient sites count stock too; the CLASS, not
    // the group, decides access.
    gate: { kind: "record_class", anyOf: ["controlled_substance_custody"] },
  },
  {
    id: "group-sessions",
    label: "Group sessions",
    desc: "Group schedule, roster & attendance",
    icon: Users,
    to: "/group-sessions",
    group: "care",
    gate: { kind: "record_class", anyOf: ["group_sessions"] },
  },
  {
    id: "group-audit",
    label: "Group eligibility audit",
    desc: "Eligibility changes & blocked enrollments",
    icon: FileSearch,
    to: "/group-audit",
    group: "care",
    gate: { kind: "record_class", anyOf: ["group_sessions"] },
  },

  // ----- Queues (cross-patient work) -----
  {
    id: "worklist",
    label: "Worklist",
    desc: "Cross-facility tasks & rounds",
    icon: ListChecks,
    to: "/worklist",
    group: "queues",
    gate: { kind: "record_class", anyOf: ["worklist"] },
  },
  {
    id: "inbox",
    label: "Inbox",
    desc: "Unsigned notes & provider requests",
    icon: Inbox,
    to: "/inbox",
    group: "queues",
    gate: { kind: "record_class", anyOf: ["provider_requests", "therapy_notes"] },
  },
  {
    id: "notes-queue",
    label: "Unsigned notes",
    desc: "Sign to release billing",
    icon: ClipboardList,
    to: "/notes-queue",
    group: "queues",
    gate: { kind: "record_class", anyOf: ["therapy_notes"] },
  },
  {
    id: "cosign-inbox",
    label: "Cosign inbox",
    desc: "Notes awaiting your cosignature",
    icon: ClipboardSignature,
    to: "/cosign-inbox",
    group: "queues",
    gate: { kind: "record_class", anyOf: ["therapy_notes"] },
  },
  {
    id: "crisis-queue",
    label: "Crisis queue",
    desc: "Escalations & disposition",
    icon: Siren,
    to: "/crisis-queue",
    group: "queues",
    gate: { kind: "record_class", anyOf: ["crisis_queue"] },
  },
  {
    id: "message-queue",
    label: "Message queue",
    desc: "Patient messages awaiting reply",
    icon: MessageSquare,
    to: "/message-queue",
    group: "queues",
    gate: { kind: "record_class", anyOf: ["patient_messaging"] },
  },

  // ----- Population health (outpatient program metrics) -----
  {
    id: "dashboards",
    label: "Population health",
    desc: "KPIs, CalAIM & drill-down",
    icon: Gauge,
    to: "/dashboards",
    group: "population",
    gate: { kind: "record_class", anyOf: ["population_health"] },
  },

  // ----- Facility & Custody -----
  {
    id: "pre-release",
    label: "Pre-release list",
    desc: "D90→0 forms & reentry care plan",
    icon: ClipboardSignature,
    to: "/pre-release",
    group: "facility",
    // Keeps the group invariant: every Facility & Custody entry gates on
    // `custody_tracking`, which both CF Care Manager and the receiving ECM
    // Provider hold write on. The page applies its own finer read gate.
    gate: { kind: "record_class", anyOf: ["custody_tracking"] },
  },
  {
    id: "released-search",
    label: "Released patient search",
    desc: "Post-release follow-up",
    icon: UserSearch,
    to: "/released-search",
    group: "facility",
    gate: { kind: "record_class", anyOf: ["custody_tracking"] },
  },
  {
    id: "facility-protocols",
    label: "Facility protocols",
    desc: "CIWA/COWS rounds for booked patients",
    icon: ClipboardList,
    // Deep link into the real Worklist, pre-filtered — see NavEntry.search.
    to: "/worklist",
    search: { view: "facility-protocols" },
    group: "facility",
    // Both gates matter: it is facility work (custody_tracking) shown through
    // the Worklist, so a role must be able to open the Worklist too.
    gate: { kind: "record_class", anyOf: ["custody_tracking"] },
  },
  {
    id: "admin-facilities",
    label: "Facilities",
    desc: "Facility registry & merges",
    icon: Building2,
    to: "/admin-facilities",
    group: "facility",
    gate: { kind: "record_class", anyOf: ["custody_tracking"] },
  },

  // ----- Revenue & consent -----
  {
    id: "billing",
    label: "Billing",
    desc: "Claims, ISL & credentials",
    icon: Receipt,
    to: "/billing",
    group: "revenue",
    gate: { kind: "record_class", anyOf: ["billing"] },
  },
  {
    id: "admin-claims",
    label: "Claims worklist",
    desc: "Charges through payment",
    icon: Receipt,
    to: "/admin-claims",
    group: "revenue",
    gate: { kind: "record_class", anyOf: ["billing"] },
  },
  {
    id: "consent",
    label: "Consent",
    desc: "Ledger & disclosures",
    icon: ShieldCheck,
    to: "/consent",
    group: "revenue",
    gate: { kind: "record_class", anyOf: ["consent_ledger"] },
  },
  {
    id: "consent-audit",
    label: "Consent audit",
    desc: "Captures, revocations & disclosures",
    icon: FileSearch,
    to: "/consent-audit",
    group: "revenue",
    gate: { kind: "record_class", anyOf: ["consent_ledger"] },
  },

  // ----- Administration (gated config surfaces; dedicated admin shell is a
  // later phase — these simply appear in the staff nav for roles that clear
  // the same gate the page itself enforces).
  {
    id: "admin",
    label: "Pilot dashboard",
    desc: "Program-level overview",
    icon: LayoutDashboard,
    to: "/admin",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["population_health"] },
  },
  {
    id: "admin-coordination",
    label: "Clinical coordination",
    desc: "Routing, conflicts & coverage",
    icon: Users,
    to: "/admin-coordination",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["care_coordination"] },
  },
  {
    id: "admin-kpi-targets",
    label: "KPI targets",
    desc: "Targets behind the dashboards",
    icon: Target,
    to: "/admin-kpi-targets",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["population_health"], minLevel: "write" },
  },
  {
    id: "admin-note-templates",
    label: "Note templates",
    desc: "Documentation template library",
    icon: FileStack,
    to: "/admin-note-templates",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["note_templates"] },
  },
  {
    id: "admin-scheduling-rules",
    label: "Scheduling rules",
    desc: "Rules that generate worklist rows",
    icon: CalendarClock,
    to: "/admin-scheduling-rules",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["scheduling_rules"] },
  },
  {
    id: "admin-catalog-governance",
    label: "Catalog governance",
    desc: "Frequencies & drug-catalog rules",
    icon: Settings2,
    to: "/admin-catalog-governance",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["catalog_governance"] },
  },
  {
    id: "admin-audit",
    label: "Audit log",
    desc: "Traceability & CSV export",
    icon: FileSearch,
    to: "/admin-audit",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["consent_ledger"] },
  },
  {
    id: "admin-credentialing",
    label: "Credentialing",
    desc: "Licenses, DEA & enrollments",
    icon: ScrollText,
    to: "/admin-credentialing",
    group: "administration",
    gate: { kind: "open" },
  },
  {
    id: "admin-vendors",
    label: "Vendor status",
    desc: "Integration health",
    icon: Settings2,
    to: "/admin-vendors",
    group: "administration",
    gate: { kind: "open" },
  },

  // ----- My account (personal settings — every staff member has their own) -----
  {
    id: "clinician-profile",
    label: "My profile",
    desc: "Specialty & languages",
    icon: UserCog,
    to: "/clinician-profile",
    group: "account",
    gate: { kind: "open" },
  },
  {
    id: "clinician-availability",
    label: "My availability",
    desc: "Weekly hours & time off",
    icon: CalendarClock,
    to: "/clinician-availability",
    group: "account",
    gate: { kind: "open" },
  },
  {
    id: "clinician-credentials",
    label: "My credentials",
    desc: "License, DEA, malpractice",
    icon: ShieldCheck,
    to: "/clinician-credentials",
    group: "account",
    gate: { kind: "open" },
  },
];

/** True when `role` clears an entry's gate. No role lists live here. */
export function canSeeNavEntry(role: StaffRole, entry: NavEntry): boolean {
  if (entry.gate.kind === "open") return true;
  const min = LEVEL_RANK[entry.gate.minLevel ?? "read"];
  return entry.gate.anyOf.some((cls) => {
    // Patient-less call: `consent_gated` classes resolve to locked, which is
    // correct for cross-patient nav — the surface itself re-checks per patient.
    const { level } = canAccess(role, cls);
    return LEVEL_RANK[level] >= min;
  });
}

/** Flat, gated entry list for a role, in registry order. */
export function staffNavForRole(role: StaffRole): NavEntry[] {
  return STAFF_NAV.filter((e) => canSeeNavEntry(role, e));
}

export interface NavGroupView {
  group: NavGroup;
  label: string;
  entries: NavEntry[];
}

/** Grouped, gated nav for a role. Empty groups are dropped. */
export function staffNavGroupsForRole(role: StaffRole): NavGroupView[] {
  const visible = staffNavForRole(role);
  return NAV_GROUP_ORDER.map((group) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    entries: visible.filter((e) => e.group === group),
  })).filter((g) => g.entries.length > 0);
}

/**
 * Gated entries for a single nav group. The admin landing page renders its
 * quick links from this, so its list and the sidebar's Administration section
 * are the same computation and cannot drift apart.
 */
export function staffNavGroupForRole(role: StaffRole, group: NavGroup): NavEntry[] {
  return staffNavForRole(role).filter((e) => e.group === group);
}

/** Hook form for components — follows the acting staff identity. */
export function useStaffNavGroups(): NavGroupView[] {
  const { role } = useActingStaff();
  return staffNavGroupsForRole(role);
}

/** Every route the staff shell owns — used to decide when to show the shell. */
export const STAFF_ROUTES: string[] = STAFF_NAV.map((e) => e.to);

// §Platform nav Phase 4 — patient shell registry.
//
// Patients are not `StaffRole`s, so these entries deliberately carry no
// `RecordClass` / access gate: the patient shell spans exactly three routes and
// every other patient surface is a section inside `/home`. The registry exists
// purely so the desktop top-nav strip and the mobile bottom tab bar read the
// same list (they previously drifted: desktop was missing `/schedule`).
export interface PatientNavEntry {
  id: string;
  /** i18n key resolved by the rendering shell. */
  labelKey: string;
  to: "/home" | "/intake" | "/schedule";
  icon: LucideIcon;
}

export const PATIENT_NAV: readonly PatientNavEntry[] = [
  { id: "home", labelKey: "navMyCare", to: "/home", icon: Heart },
  { id: "intake", labelKey: "navIntake", to: "/intake", icon: ClipboardList },
  { id: "schedule", labelKey: "schTitle", to: "/schedule", icon: Calendar },
] as const;

/** Every route the patient shell owns. */
export const PATIENT_ROUTES: readonly PatientNavEntry["to"][] = PATIENT_NAV.map((e) => e.to);
