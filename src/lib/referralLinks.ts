// §Advocate Access Redesign — Phase 4, step 1.
//
// Referential integrity between a patient's `ResourceReferral` and the real
// community-resource directory.
//
// The discipline is borrowed from the Library-category rule (a container that
// still holds live lessons cannot be deleted, only withdrawn, and its history
// is kept): a referral's link to a directory org is HISTORY, so nothing here
// ever clears `resourceId`. What changes when an org is unpublished or
// removed is the *state of the link*, reported here, not the referral record.
//
// Deliberate difference from the Library rule: an org going away is a real
// world event (it closes, it moves out of area), so retiring a listing is NOT
// blocked by referrals pointing at it. The referral degrades to exactly the
// external-referral behaviour that already works — `provider` free text is
// the record of truth — and the link is flagged.

import type { ResourceReferral } from "@/lib/ehr";
import {
  getResource,
  patientVisibleResource,
  type CommunityResource,
} from "@/lib/communityResources";

export type ResourceLinkState =
  /** No `resourceId` — a genuinely external referral. `provider` is the record. */
  | { kind: "external"; provider: string }
  /** Linked to an org that is still a published directory listing. */
  | { kind: "active"; resourceId: string; resource: CommunityResource }
  /**
   * Linked to an org that still exists in the directory but is no longer
   * published to patients (withdrawn / unverified again).
   */
  | { kind: "inactive"; resourceId: string; resource: CommunityResource }
  /** Linked to an org id the directory no longer holds at all. */
  | { kind: "missing"; resourceId: string; provider: string };

/**
 * PURE-ish read: resolve what a referral's directory link means right now.
 * Never mutates the referral.
 */
export function resourceLinkState(referral: ResourceReferral): ResourceLinkState {
  const id = referral.resourceId;
  if (!id) return { kind: "external", provider: referral.provider };
  const resource = getResource(id);
  if (!resource) return { kind: "missing", resourceId: id, provider: referral.provider };
  const published = patientVisibleResource(id);
  return published
    ? { kind: "active", resourceId: id, resource: published }
    : { kind: "inactive", resourceId: id, resource };
}

/** True when the linked org can still be handed to a patient as a live listing. */
export function isResourceLinkActive(referral: ResourceReferral): boolean {
  return resourceLinkState(referral).kind === "active";
}

/**
 * The name to show for a referral, whatever happened to the directory: the
 * live listing name when the link is good, the recorded free text otherwise.
 * This is why an unpublished org can never blank out a historical referral.
 */
export function referralProviderLabel(referral: ResourceReferral): string {
  const state = resourceLinkState(referral);
  return state.kind === "active" || state.kind === "inactive"
    ? state.resource.name
    : referral.provider;
}
