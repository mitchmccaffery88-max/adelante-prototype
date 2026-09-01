// §Platform nav — RBAC-driven navigation registry (Phase 1).
//
// This is the cross-patient sibling of `recordSections.tsx`: one registry, one
// gate model, and entries a role cannot access are OMITTED rather than
// disabled. It deliberately does NOT define who may see what — every entry
// points at a `RecordClass` that already exists in the roles matrix, so adding
// a role or changing a permission is a matrix edit, never a nav edit.
import type { PopulationTrack } from "@/lib/population";
import {
  BookOpen,
  Building2,
  Calendar,
  Heart,
  Map,
  CalendarClock,
  ClipboardList,
  ClipboardSignature,
  FileInput,
  FileSearch,
  FileStack,
  FileText,
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
  FileEdit,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Target,
  UserCog,
  UserCheck,
  UserPlus,
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
    // §Front-door Phase 3 — Tier 2. Nav-registered like every other staff
    // tool so it's discoverable rather than a hidden URL.
    id: "assisted-signup",
    label: "Assisted sign-up",
    desc: "Enroll or claim a code for someone",
    icon: UserPlus,
    to: "/assisted-signup",
    group: "care",
    gate: { kind: "record_class", anyOf: ["assisted_signup"], minLevel: "write" },
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
    // §Build 5 — no longer the generic `custody_tracking` class. The
    // pre-release reentry workspace has its own matrix row naming its real
    // owners (CF Care Manager, MAT prescriber, screening clinicians, clinical
    // coordinator, receiving ECM Provider, sys_admin). Still a matrix edit,
    // still the same `canSeeNavEntry` gate model — no role list lives here.
    // `canReadPreRelease` gates the page on the SAME row.
    gate: { kind: "record_class", anyOf: ["pre_release"] },
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
    // §Content Management — same config tier as note templates: not patient
    // data, but what every patient is SHOWN.
    id: "admin-content",
    label: "Patient content",
    desc: "Lessons, community resources & naloxone access — author and publish",
    icon: FileEdit,
    to: "/admin-content",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["content_authoring"] },
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
    // §Quality pass Group E — document lifecycle trail. Gated on the
    // `documents` class the pages themselves use, so RBAC stays a matrix edit.
    id: "admin-documents-audit",
    label: "Documents audit",
    desc: "Uploads, Part 2 calls, blocks & promotions",
    icon: FileSearch,
    to: "/admin-documents-audit",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["documents"] },
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
    // §Quality pass Group A — supervision links for supervised roles. Gated on
    // the `staff_supervision` class, so RBAC stays a matrix edit, not a nav edit.
    id: "admin-supervision",
    label: "Supervision",
    desc: "Trainee & MA supervisor links",
    icon: UserCheck,
    to: "/admin-supervision",
    group: "administration",
    gate: { kind: "record_class", anyOf: ["staff_supervision"] },
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
export type PatientRoute =
  | "/home"
  | "/adel"
  | "/library"
  | "/resources"
  | "/recovery-journey"
  | "/schedule"
  | "/intake"
  // §P1 My Care de-clutter — real routes for what used to be `/home` anchors.
  // Medication, Profile and Documents each own a real surface now, so the nav
  // entry is a destination rather than a scroll position inside My Care.
  | "/medications"
  | "/profile"
  | "/documents"
  // §Weekly recap — real weekly stats plus a one-off Adel reflection.
  | "/weekly-recap"
  // §Tier 1 Build A — real crisis landing page and the naloxone /
  // overdose-prevention content it links to. Not nav entries (crisis is a
  // pinned action, naloxone is reached from it), but both are patient-shell
  // routes and must theme/gate like the rest.
  | "/crisis"
  // §P2 — the full editable safety plan owns a real route (was a /home anchor).
  | "/safety-plan"
  | "/naloxone"
  // §Tier 1 Build B — patient-private tools reached from the home dashboard,
  // the craving FAB and the resources header, not from the nav registry.
  | "/craving"
  | "/slip"
  // §Standalone route items — the daily mood check-in owns a real route,
  // reached from the /home entry card (same precedent as /craving and /slip).
  | "/checkin"
  // §Standalone route items — a focused view of the SAME care-team thread,
  // scoped to the peer specialist. Reached from My Care's messages card.
  | "/peer"
  // §Standalone route items — read-only aggregation of the tools the patient
  // built inside lessons. Reached from the Recovery Journey header.
  | "/toolkit"
  | "/resources/saved";

export interface PatientNavEntry {
  id: string;
  /** i18n key resolved by the rendering shell. */
  labelKey: string;
  to: PatientRoute;
  /** In-page anchor when the destination is a section of `to`. */
  hash?: string;
  icon: LucideIcon;
  /** True when the entry is one of the five bottom tabs on mobile. */
  mobile: boolean;
  /**
   * Population tracks this entry is FOR. Omitted = every track. An entry that
   * points at population-gated content must list its tracks here, or a
   * general-population patient gets a nav link to a section that gates itself
   * away — a dead end.
   */
  populations?: PopulationTrack[];
}

/**
 * §Patient portal correction — this list and its ordering mirror the real
 * source app-shell nav array: the five `mobile: true` entries are the bottom
 * tab bar, every other entry is reachable from the "More" bottom sheet on
 * mobile and from the sidebar on desktop.
 */
export const PATIENT_NAV: readonly PatientNavEntry[] = [
  { id: "home", labelKey: "navMyCare", to: "/home", icon: Heart, mobile: true },
  // Nav slot reserved now; the assistant itself is a deferred phase.
  { id: "adel", labelKey: "navAdel", to: "/adel", icon: MessageSquare, mobile: true },
  { id: "library", labelKey: "navLibrary", to: "/library", icon: BookOpen, mobile: true },
  { id: "resources", labelKey: "navResources", to: "/resources", icon: Map, mobile: true },
  {
    id: "recovery-journey",
    labelKey: "navRecoveryJourney",
    to: "/recovery-journey",
    icon: Sparkles,
    mobile: true,
  },
  // ----- overflow ("More" sheet on mobile, sidebar on desktop) -----
  {
    id: "journey",
    labelKey: "navCarePlan",
    to: "/home",
    hash: "your-care-plan-heading",
    icon: Target,
    mobile: false,
  },
  {
    id: "obligations",
    labelKey: "navObligations",
    to: "/home",
    hash: "obligations",
    icon: ClipboardSignature,
    mobile: false,
    // ObligationsCard is `PopulationGate`d to the justice-involved tracks.
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    // §Standalone route items — this entry already existed and pointed at the
    // My Care messages anchor. It now points at the real focused view of that
    // SAME thread; no new nav slot was invented.
    id: "peer-navigator",
    labelKey: "navPeerNavigator",
    to: "/peer",
    icon: HandHeart,
    mobile: false,
  },

  { id: "appointments", labelKey: "navAppointments", to: "/schedule", icon: Calendar, mobile: false },
  // §P1 My Care de-clutter — real destinations, not `/home` anchors. The
  // duplicated tiles were removed from My Care, so an anchor would now scroll
  // to nothing.
  { id: "medication", labelKey: "navMedication", to: "/medications", icon: Pill, mobile: false },
  { id: "profile", labelKey: "navProfile", to: "/profile", icon: UserCog, mobile: false },
  { id: "documents", labelKey: "navDocuments", to: "/documents", icon: FileText, mobile: false },
  {
    id: "weekly-recap",
    labelKey: "navWeeklyRecap",
    to: "/weekly-recap",
    icon: Sparkles,
    mobile: false,
  },
  // Not in the source nav, but /intake is a real patient route here and must
  // stay reachable rather than becoming an orphan.
  { id: "intake", labelKey: "navIntake", to: "/intake", icon: ClipboardList, mobile: false },
] as const;

/** The five bottom tabs. */
export const PATIENT_MOBILE_NAV = PATIENT_NAV.filter((e) => e.mobile);
/** Everything else — the "More" bottom sheet. */
export const PATIENT_MORE_NAV = PATIENT_NAV.filter((e) => !e.mobile);

/**
 * Drop entries whose destination is population-gated away from this person.
 * Same rule as the staff nav: an entry you cannot use is OMITTED, not shown
 * disabled or left to dead-end on a gated section.
 */
export function patientNavForPopulation<T extends PatientNavEntry>(
  entries: readonly T[],
  track: PopulationTrack,
): T[] {
  return entries.filter((e) => !e.populations || e.populations.includes(track));
}

/** Patient-shell routes that are not nav entries. */
export const PATIENT_EXTRA_ROUTES: readonly PatientRoute[] = [
  "/crisis",
  "/safety-plan",
  "/naloxone",
  "/craving",
  "/slip",
  "/checkin",
  "/toolkit",
  "/resources/saved",
];

/** Every route the patient shell owns (deduped — several entries are anchors). */
export const PATIENT_ROUTES: readonly PatientRoute[] = Array.from(
  new Set([...PATIENT_NAV.map((e) => e.to), ...PATIENT_EXTRA_ROUTES]),
);

// §Patient portal Build 1 — responsive nav shell.
//
// The bottom tab bar keeps the five real patient ROUTES (PATIENT_NAV); the
// desktop/tablet sidebar is a superset that also deep-links to the sections
// that still genuinely live on /home (care plan, obligations, care messages).
// Medication, Profile and Documents are real routes as of the My Care
// de-clutter pass.
export type PatientSidebarEntry = PatientNavEntry;

/** Desktop sidebar shows the whole registry in source order. */
export const PATIENT_SIDEBAR_NAV: readonly PatientNavEntry[] = PATIENT_NAV;

// §Landing nav — the public, pre-sign-in surface. It deliberately does NOT
// reuse PATIENT_NAV: a visitor who has not signed in has no care plan,
// medications or recap to open. Real page anchors + one Get-started action.
export interface PublicNavEntry {
  id: string;
  label: string;
  to: "/" | "/start";
  hash?: string;
}

export const PUBLIC_NAV: readonly PublicNavEntry[] = [
  { id: "how-it-works", label: "How it works", to: "/", hash: "how-it-works" },
  { id: "what-you-get", label: "What you get", to: "/", hash: "what-you-get" },
  { id: "who-its-for", label: "Who it's for", to: "/", hash: "who-its-for" },
] as const;

/** Routes that render the public marketing/entry shell. */
export const PUBLIC_ROUTES: readonly string[] = ["/", "/auth", "/assisted-signup"];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/start");
}

// §Advocate Access Redesign Phase 1 — advocate surfaces get their own nav
// registry. Root cause of the leak this fixes: `/advocate` is neither a
// patient route, a public route, nor a staff route, so the shell's desktop
// strip fell through to PATIENT_NAV — the same missing-branch bug as the
// earlier staff-surface leak.
//
// The advocate workspace is a single route composed of panels, so these
// entries are real in-page section anchors, not invented destinations. Each
// hash matches a section actually rendered by `src/routes/advocate.tsx`.
export interface AdvocateNavEntry {
  id: string;
  label: string;
  to: "/advocate";
  hash: string;
  icon: LucideIcon;
}

export const ADVOCATE_NAV: readonly AdvocateNavEntry[] = [
  { id: "access", label: "Access", to: "/advocate", hash: "advocate-access", icon: ShieldCheck },
  {
    id: "appointments",
    label: "Appointments",
    to: "/advocate",
    hash: "advocate-appointments",
    icon: Calendar,
  },
  {
    id: "paperwork",
    label: "Paperwork",
    to: "/advocate",
    hash: "advocate-paperwork",
    icon: ClipboardSignature,
  },
  {
    id: "messages",
    label: "Messages",
    to: "/advocate",
    hash: "advocate-messages",
    icon: MessageSquare,
  },
  {
    id: "coordination",
    label: "Coordination",
    to: "/advocate",
    hash: "advocate-coordination",
    icon: HandHeart,
  },
  {
    id: "documents",
    label: "Documents",
    to: "/advocate",
    hash: "advocate-documents",
    icon: FileText,
  },
] as const;

/** Routes that render the advocate shell. */
export const ADVOCATE_ROUTES: readonly string[] = ["/advocate"];

export function isAdvocateRoute(pathname: string): boolean {
  return ADVOCATE_ROUTES.includes(pathname);
}
