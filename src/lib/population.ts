// §Adelante Journey Phase 2 — population-aware front-end architecture.
//
// ONE population concept, DERIVED. There is deliberately no new
// `populationTrack` field on Patient: a stored field drifts the moment an
// episode closes or a front-door answer is corrected. Everything here is read
// out of the data that ALREADY distinguishes these people:
//
//   • `PreReleaseEpisode` (status open|released|closed, `missedHandoff`)
//   • `Patient.coverage.justiceInvolvement`  (front-door TriState answer)
//   • `Patient.frontDoor.heardAbout`         (referral-source answer)
//   • `Patient.referralId`                   (formal Referral submission)
//   • `Patient.missedPreReleaseCoordination` (Front-door Phase 2 flag)
//
// The Advocate case is NOT a patient population. An advocate is an external
// person on their own surface (`/advocate`, `AdvocateLink`) — see
// mem://features/advocate-access. It is represented here only so that a
// caller which does not know who is viewing can never accidentally resolve an
// advocate into the patient's own track.
import { AdelanteEHR } from "@/lib/ehr";
import type { HeardAboutSource, TriState } from "@/lib/frontDoor";

export type PopulationTrack =
  /** Track A — in custody, coordination happening before release. */
  | "pre_release_ji"
  /** Released, or arrived by a justice-linked referral, after release. */
  | "post_release_ji"
  /** No justice-involvement signal anywhere in the record. */
  | "general_population"
  /** Not a patient population — an advocate viewing someone else's record. */
  | "advocate";

export const POPULATION_LABEL: Record<PopulationTrack, string> = {
  pre_release_ji: "Pre-release (justice-involved)",
  post_release_ji: "Post-release / direct referral (justice-involved)",
  general_population: "General population",
  advocate: "Advocate (viewing another person's record)",
};

/** Referral sources that are themselves a justice-involvement signal. */
const JUSTICE_HEARD_ABOUT: HeardAboutSource[] = [
  "probation_parole_drug_court",
  "correctional_health",
];

/** The raw facts a track is derived from. Pure input — no store access. */
export interface PopulationFacts {
  /** Every pre-release episode for this patient, any status. */
  preReleaseEpisodes: { status: "open" | "released" | "closed"; missedHandoff?: boolean }[];
  justiceInvolvement?: TriState;
  heardAbout?: HeardAboutSource;
  hasReferralRecord: boolean;
  hasMissedPreReleaseFlag: boolean;
  /**
   * `Patient.coverage.jiReentryFlag` — the Medi-Cal Justice-Involved Reentry
   * Initiative box ("I'm coming home within the next 90 days"). Intake tells
   * the person it "unlocks pre-release coordination", so it has to count as a
   * confirmed justice signal here. It does NOT by itself prove current
   * custody, so it resolves post-release: only a real open `PreReleaseEpisode`
   * (rule 1) may claim `pre_release_ji`.
   */
  hasJiReentryFlag?: boolean;
}

export interface PopulationResolution {
  track: PopulationTrack;
  /** Why — the actual fact that decided it, for debugging and audit copy. */
  basis: string;
  /**
   * True when justice involvement is only "unsure" / not yet established.
   * Callers should treat an unconfirmed track as NOT a license to show
   * justice-specific content; it means "ask", not "assume".
   */
  provisional: boolean;
}

/** PURE. Given facts, decide the track. */
export function resolvePopulationTrack(facts: PopulationFacts): PopulationResolution {
  const eps = facts.preReleaseEpisodes ?? [];

  // 1. Still inside. An OPEN episode that is not a post-release catch-up is
  //    the strongest and most specific signal there is.
  const openInCustody = eps.find((e) => e.status === "open" && !e.missedHandoff);
  if (openInCustody) {
    return { track: "pre_release_ji", basis: "open pre-release episode", provisional: false };
  }

  // 2. Justice-involved, but out. Any of: an episode that has reached
  //    released/closed, a missed-handoff catch-up episode, the Phase 2 missed
  //    coordination flag, a confirmed front-door answer, or a justice-linked
  //    referral source.
  if (eps.some((e) => e.status === "released" || e.status === "closed")) {
    return { track: "post_release_ji", basis: "released/closed pre-release episode", provisional: false };
  }
  if (eps.some((e) => e.missedHandoff) || facts.hasMissedPreReleaseFlag) {
    return { track: "post_release_ji", basis: "missed pre-release coordination", provisional: false };
  }
  if (facts.justiceInvolvement === "yes") {
    return { track: "post_release_ji", basis: "front-door justice-involvement answer", provisional: false };
  }
  if (facts.hasJiReentryFlag) {
    return {
      track: "post_release_ji",
      basis: "Medi-Cal justice-involved reentry flag",
      provisional: false,
    };
  }
  if (facts.heardAbout && JUSTICE_HEARD_ABOUT.includes(facts.heardAbout)) {
    return { track: "post_release_ji", basis: `referral source: ${facts.heardAbout}`, provisional: false };
  }
  if (facts.justiceInvolvement === "unsure") {
    // Not general population, not confirmed either. Provisional on purpose:
    // "we will check", never a promise and never a denial — the same posture
    // `coverageMessage` in frontDoor.ts already takes for "unsure".
    return {
      track: "post_release_ji",
      basis: "justice involvement answered 'not sure' — unconfirmed",
      provisional: true,
    };
  }

  return {
    track: "general_population",
    basis: facts.hasReferralRecord ? "referral with no justice signal" : "no justice signal",
    provisional: false,
  };
}

/**
 * Who is looking. An advocate short-circuits everything: they are on their own
 * surface and must never inherit the patient's population track.
 */
export type PopulationViewer =
  | { kind: "patient" }
  | { kind: "advocate"; advocateLinkId: string }
  | { kind: "staff" };

/** Gather live facts for a patient out of the real record. */
export function populationFactsFor(patientId: string): PopulationFacts | undefined {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return undefined;
  return {
    preReleaseEpisodes: AdelanteEHR.listPreReleaseEpisodes(patientId).map((e) => ({
      status: e.status,
      ...(e.missedHandoff === undefined ? {} : { missedHandoff: e.missedHandoff }),
    })),
    ...(p.coverage?.justiceInvolvement ? { justiceInvolvement: p.coverage.justiceInvolvement } : {}),
    ...(p.frontDoor?.heardAbout ? { heardAbout: p.frontDoor.heardAbout } : {}),
    hasReferralRecord: Boolean(p.referralId),
    hasMissedPreReleaseFlag: Boolean(p.missedPreReleaseCoordination),
    hasJiReentryFlag: Boolean(p.coverage?.jiReentryFlag),
  };
}

/**
 * The resolver everything patient-facing should call.
 *
 * `viewer` defaults to the patient themselves. Pass the advocate viewer on any
 * surface reachable from `/advocate` — it resolves to `advocate` WITHOUT ever
 * reading the patient's population signals.
 */
export function resolvePopulation(
  patientId: string | undefined,
  viewer: PopulationViewer = { kind: "patient" },
): PopulationResolution {
  if (viewer.kind === "advocate") {
    return {
      track: "advocate",
      basis: "advocate link — separate surface, not a patient population",
      provisional: false,
    };
  }
  const facts = patientId ? populationFactsFor(patientId) : undefined;
  if (!facts) {
    // Unknown record: the safe default is the track with no population-specific
    // promises attached to it.
    return { track: "general_population", basis: "no patient record", provisional: true };
  }
  return resolvePopulationTrack(facts);
}

/**
 * The gating predicate. `allow` lists the tracks a feature is FOR.
 *
 * `requireConfirmed` (default true) means a provisional resolution does not
 * satisfy a justice-involved-only gate — an unconfirmed "not sure" answer must
 * not surface reentry-program content as though it were established.
 */
export function isPopulationAllowed(
  resolution: PopulationResolution,
  allow: PopulationTrack[],
  opts: { requireConfirmed?: boolean } = {},
): boolean {
  if (!allow.includes(resolution.track)) return false;
  if (opts.requireConfirmed === false) return true;
  return !resolution.provisional;
}