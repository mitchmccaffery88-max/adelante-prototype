// §Pre-release build 5 — DHCS JI-Reentry staged timeline.
//
// Presentation logic only: it derives WHERE an episode sits in the real
// DHCS-staged window from `anticipatedReleaseDate` relative to today. It reads
// no store and changes no permission — the phases below are a lens over data
// Builds 1-4 already capture.
//
// The final stretch deliberately does NOT invent a countdown mechanism: the
// T-72h phase is the last window in which pre-release coordination can still
// happen BEFORE front-door Phase 2's safety net has to catch the person
// afterwards (`generateMissedHandoffCatchUp` → `missedPreReleaseCoordination`
// → an episode flagged `missedHandoff`). An episode already carrying that flag
// is rendered as the `catch_up` phase rather than being forced onto a
// pre-release countdown it can never satisfy.

export type PreReleasePhase =
  | "pre_window"
  | "intake_screening"
  | "coordination"
  | "warm_handoff"
  | "released"
  | "catch_up";

export const PRE_RELEASE_PHASE_LABEL: Record<PreReleasePhase, string> = {
  pre_window: "Before T-90",
  intake_screening: "T-90 → T-60 · intake & screening",
  coordination: "T-60 → T-72h · care plan, MAT & appointments",
  warm_handoff: "T-72h · warm handoff prep",
  released: "Released",
  catch_up: "Day-one catch-up (missed handoff)",
};

export const PRE_RELEASE_PHASE_HELP: Record<PreReleasePhase, string> = {
  pre_window:
    "Release is more than 90 days out. The DHCS intake window has not opened yet; the episode can be prepared but nothing is due.",
  intake_screening:
    "The DHCS intake window: profile creation, capacity/legal-authority determination, SDOH (AHC-HRSN) and SUD screening (AUDIT-10 / DAST-10).",
  coordination:
    "Ongoing reentry work: reentry care plan development, MAT initiation, community appointment scheduling and advocate designation.",
  warm_handoff:
    "Final 72 hours. Everything the receiving ECM Provider needs must be in place now — after release an incomplete handoff falls to the front-door safety net instead.",
  released:
    "The anticipated release date has passed. Continuity moves to the receiving ECM Provider and the post-release care plan.",
  catch_up:
    "Pre-release coordination never happened; this episode was opened AFTER release by the front-door safety net and is compressed into day one.",
};

/** Days from `today` until the release date. Negative once release has passed. */
export function daysUntilRelease(anticipatedReleaseDate: string, today = new Date()): number {
  const rel = Date.parse(`${anticipatedReleaseDate}T00:00:00Z`);
  if (Number.isNaN(rel)) return Number.NaN;
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((rel - t0) / 86_400_000);
}

/** Boundaries, in days before release, exactly as the guidance stages them. */
export const T_INTAKE_OPEN = 90;
export const T_INTAKE_CLOSE = 60;
/** 72 hours = 3 days. */
export const T_WARM_HANDOFF = 3;

export interface PreReleaseTimeline {
  phase: PreReleasePhase;
  label: string;
  help: string;
  /** Null when the release date is unparseable, or for catch-up episodes. */
  daysUntilRelease: number | null;
  /** Hours remaining in the final stretch; only set inside `warm_handoff`. */
  hoursUntilRelease?: number;
  /** True while the T-90 → T-60 intake/screening window is open. */
  intakeWindowOpen: boolean;
  /** True inside the final 72 hours before release. */
  inWarmHandoffWindow: boolean;
  /** Ordered milestone rows for the timeline view. */
  milestones: PreReleaseMilestone[];
}

export interface PreReleaseMilestone {
  key: "intake_screening" | "coordination" | "warm_handoff" | "release";
  label: string;
  /** Calendar date this window opens (ISO), or the release date itself. */
  date: string;
  state: "upcoming" | "active" | "passed";
}

const isoShift = (anticipatedReleaseDate: string, minusDays: number): string => {
  const rel = Date.parse(`${anticipatedReleaseDate}T00:00:00Z`);
  if (Number.isNaN(rel)) return anticipatedReleaseDate;
  return new Date(rel - minusDays * 86_400_000).toISOString().slice(0, 10);
};

export function preReleasePhase(
  input: { anticipatedReleaseDate: string; missedHandoff?: boolean },
  today = new Date(),
): PreReleasePhase {
  if (input.missedHandoff) return "catch_up";
  const d = daysUntilRelease(input.anticipatedReleaseDate, today);
  if (Number.isNaN(d)) return "coordination";
  if (d < 0) return "released";
  if (d <= T_WARM_HANDOFF) return "warm_handoff";
  if (d <= T_INTAKE_CLOSE) return "coordination";
  if (d <= T_INTAKE_OPEN) return "intake_screening";
  return "pre_window";
}

export function preReleaseTimeline(
  input: { anticipatedReleaseDate: string; missedHandoff?: boolean },
  today = new Date(),
): PreReleaseTimeline {
  const phase = preReleasePhase(input, today);
  const raw = daysUntilRelease(input.anticipatedReleaseDate, today);
  const d = Number.isNaN(raw) ? null : raw;

  const state = (opens: number, closes: number | null): PreReleaseMilestone["state"] => {
    if (d === null || phase === "catch_up") return "upcoming";
    if (d > opens) return "upcoming";
    if (closes !== null && d <= closes) return "passed";
    return "active";
  };

  const milestones: PreReleaseMilestone[] = [
    {
      key: "intake_screening",
      label: "Intake & screening window opens (T-90)",
      date: isoShift(input.anticipatedReleaseDate, T_INTAKE_OPEN),
      state: state(T_INTAKE_OPEN, T_INTAKE_CLOSE - 1),
    },
    {
      key: "coordination",
      label: "Care plan, MAT & appointments (T-60)",
      date: isoShift(input.anticipatedReleaseDate, T_INTAKE_CLOSE),
      state: state(T_INTAKE_CLOSE, T_WARM_HANDOFF),
    },
    {
      key: "warm_handoff",
      label: "Warm handoff prep (T-72 hours)",
      date: isoShift(input.anticipatedReleaseDate, T_WARM_HANDOFF),
      state: state(T_WARM_HANDOFF, -1),
    },
    {
      key: "release",
      label: "Anticipated release",
      date: input.anticipatedReleaseDate,
      state: d === null ? "upcoming" : d > 0 ? "upcoming" : d === 0 ? "active" : "passed",
    },
  ];

  return {
    phase,
    label: PRE_RELEASE_PHASE_LABEL[phase],
    help: PRE_RELEASE_PHASE_HELP[phase],
    daysUntilRelease: phase === "catch_up" ? null : d,
    ...(phase === "warm_handoff" && d !== null ? { hoursUntilRelease: d * 24 } : {}),
    intakeWindowOpen: phase === "intake_screening",
    inWarmHandoffWindow: phase === "warm_handoff",
    milestones,
  };
}

/**
 * Receiving-side narrowing. Everyone who clears the `pre_release` matrix row
 * can OPEN the workspace; an ECM Provider is the receiving continuity point,
 * so they see the episodes handing off to them, not the whole facility list.
 */
export function visiblePreReleaseEpisodes<
  E extends { receivingEcmStaffId?: string; cfCareManagerStaffId: string },
>(episodes: E[], role: string, staffId?: string): E[] {
  if (role !== "ecm_provider") return episodes;
  if (!staffId) return [];
  return episodes.filter(
    (e) => e.receivingEcmStaffId === staffId || e.cfCareManagerStaffId === staffId,
  );
}