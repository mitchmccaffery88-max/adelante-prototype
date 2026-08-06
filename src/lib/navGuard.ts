// §Platform nav — route-level access guard.
//
// Deep links bypass navigation: a role that never SEES an entry in the sidebar
// can still type/bookmark the URL. This module turns the same registry gate
// used to render nav (`canSeeNavEntry`) into a redirect decision, so an
// unauthorized deep link lands on a safe surface instead of rendering the
// gated page. Per-route locked states stay in place as a backstop; this is
// defence in depth, not a replacement.
import { STAFF_NAV, canSeeNavEntry, type NavEntry } from "./navSections";
import type { StaffRole } from "./roles";

/** Where a denied role gets sent, in preference order. */
const PREFERRED_LANDINGS = [
  "/clinician",
  "/case-manager",
  "/worklist",
  "/inbox",
  "/dashboards",
  "/billing",
  "/clinician-profile",
];

/** Last resort when a role clears no staff surface at all. */
export const PATIENT_HOME = "/home";

export type NavAccess =
  | { status: "unregistered" }
  | { status: "allowed"; entry: NavEntry }
  | { status: "denied"; entry: NavEntry; redirectTo: string; message: string };

export function entryForPath(pathname: string): NavEntry | undefined {
  // Entries carrying `search` are pre-filtered views of a page that has its own
  // registry entry (§Facility & Custody: "Facility protocols" → /worklist).
  // Path-level gating belongs to the underlying page, so skip the views here.
  return STAFF_NAV.find((e) => e.to === pathname && !e.search);
}

/** First surface this role may actually open. */
export function safeLandingFor(role: StaffRole): string {
  const allowed = STAFF_NAV.filter((e) => canSeeNavEntry(role, e));
  const preferred = PREFERRED_LANDINGS.find((to) =>
    allowed.some((e) => e.to === to),
  );
  return preferred ?? allowed[0]?.to ?? PATIENT_HOME;
}

/**
 * Pure decision for a pathname. Routes outside the registry (patient
 * surfaces, `/record/$patientId`, auth) are `unregistered` and left alone —
 * they own their own gating.
 */
export function resolveNavAccess(role: StaffRole, pathname: string): NavAccess {
  const entry = entryForPath(pathname);
  if (!entry) return { status: "unregistered" };
  if (canSeeNavEntry(role, entry)) return { status: "allowed", entry };
  return {
    status: "denied",
    entry,
    redirectTo: safeLandingFor(role),
    message: `${entry.label} isn't available for your role`,
  };
}