// §SDOH Referral Thread Phase 5d-4 — ONE picture of a need for the patient.
//
// Before this module the patient saw two disconnected lists: `/next-steps`
// showed open needs with directory categories, and a separate "Referrals for
// you" card on the home screen showed referrals with no indication of WHICH
// need each one served. This module pairs them.
//
// HARD BOUNDARY: the returned shape carries NO staff material. The 5d-3
// activity log, barriers, contact attempts and staff notes are not filtered
// out downstream — they are simply never read here, so no component can leak
// them by accident.
//
// Every visible string is an i18n KEY, not English text. Patient self-service
// is English/Spanish; composing sentences in this module would hardcode
// English word order.
import {
  AdelanteEHR,
  isPart2SensitiveCategory,
  RESOURCE_REFERRAL_CLOSED_OUTCOMES,
  type ResourceReferral,
  type ResourceReferralOutcome,
  type SdohPlanItem,
} from "@/lib/ehr";

/** i18n keys this module can emit. Kept as plain strings for the `t()` call. */
export type NeedThreadKey = string;

/** How long a resolved need keeps saying goodbye before it leaves the list. */
export const RESOLVED_CLOSURE_WINDOW_DAYS = 14;

export interface NeedReferralLine {
  referralId: string;
  outcome: ResourceReferralOutcome;
  /**
   * The organisation name, or `undefined` when it must not be named. Part 2
   * sensitive categories (recovery meetings, support groups) stay
   * CATEGORY-ONLY on the patient side: no directory listing carries a Part 2
   * classification yet, so naming the org risks disclosing SUD involvement on
   * a screen someone else may be reading over a shoulder.
   */
  orgName?: string;
  /** i18n key for the plain-language status sentence, minus the org. */
  statusKey: NeedThreadKey;
  /** True when `orgName` is withheld and the generic placeholder applies. */
  orgWithheld: boolean;
}

export interface NeedThread {
  need: SdohPlanItem;
  referrals: NeedReferralLine[];
  /** i18n key used when there is no patient-visible referral yet. */
  noReferralKey: NeedThreadKey;
}

export interface ResolvedNeedClosure {
  needId: string;
  need: string;
  /** i18n key: "Resolved — …. Let your care team know if this comes back." */
  closureKey: NeedThreadKey;
  updatedAt: string;
}

const STATUS_KEY: Record<ResourceReferralOutcome, NeedThreadKey> = {
  pending: "needRefPending",
  connected: "needRefConnected",
  waitlisted: "needRefWaitlisted",
  not_eligible: "needRefNotEligible",
  declined_by_client: "needRefDeclined",
  unreachable: "needRefUnreachable",
  closed: "needRefClosed",
};

function patientVisible(r: ResourceReferral): boolean {
  return r.visibleToPatient !== false;
}

function line(r: ResourceReferral): NeedReferralLine {
  const withheld = isPart2SensitiveCategory(r.category);
  return {
    referralId: r.id,
    outcome: r.status,
    ...(withheld ? {} : { orgName: r.provider }),
    statusKey: STATUS_KEY[r.status] ?? "needRefPending",
    orgWithheld: withheld,
  };
}

/** A need still being worked: not completed and not abandoned. */
export function isOpenNeed(i: SdohPlanItem): boolean {
  return i.status !== "completed" && i.status !== "not_completed";
}

/**
 * Open, patient-visible needs, each paired with its own patient-visible
 * referrals. Safety-sensitive needs default to `visibleToPatient: false`
 * (5d-2) and are excluded by the same check as everything else.
 */
export function patientNeedThreads(patientId: string): NeedThread[] {
  const p = AdelanteEHR.getPatient(patientId);
  const items = (p?.sdohPlan?.items ?? []).filter(
    (i) => i.visibleToPatient !== false && isOpenNeed(i),
  );
  return items.map((need) => ({
    need,
    referrals: AdelanteEHR.referralsForNeed(patientId, need.id)
      .filter(patientVisible)
      .map(line),
    noReferralKey: "needRefNone",
  }));
}

/**
 * Patient-visible referrals that are NOT attached to any open, visible need —
 * older standalone referrals, or ones whose need was resolved. They are shown
 * under their own heading rather than dropped, so nothing the patient was
 * already told about silently disappears.
 */
export function unlinkedPatientReferrals(patientId: string): NeedReferralLine[] {
  const p = AdelanteEHR.getPatient(patientId);
  const threadedIds = new Set(
    patientNeedThreads(patientId).flatMap((t) => t.referrals.map((r) => r.referralId)),
  );
  return (p?.resourceReferrals ?? [])
    .filter(patientVisible)
    .filter((r) => !threadedIds.has(r.id))
    .map(line);
}

/**
 * Needs resolved recently. They leave the active list, but say goodbye first —
 * a need that just vanishes reads like the system lost it.
 */
export function recentlyResolvedNeeds(
  patientId: string,
  now = new Date(),
  windowDays = RESOLVED_CLOSURE_WINDOW_DAYS,
): ResolvedNeedClosure[] {
  const p = AdelanteEHR.getPatient(patientId);
  const from = now.getTime() - windowDays * 86_400_000;
  return (p?.sdohPlan?.items ?? [])
    .filter((i) => i.visibleToPatient !== false && !isOpenNeed(i))
    .filter((i) => {
      const t = Date.parse(i.updatedAt);
      return Number.isFinite(t) && t >= from;
    })
    .map((i) => ({
      needId: i.id,
      need: i.need,
      closureKey: "needClosureResolved",
      updatedAt: i.updatedAt,
    }));
}

/** Count used by the home summary card so the two screens can never disagree. */
export function openNeedCount(patientId: string): number {
  return patientNeedThreads(patientId).length;
}

/** True when a referral outcome has ended its active work. */
export function isReferralClosedOutcome(o: ResourceReferralOutcome): boolean {
  return RESOURCE_REFERRAL_CLOSED_OUTCOMES.includes(o);
}
