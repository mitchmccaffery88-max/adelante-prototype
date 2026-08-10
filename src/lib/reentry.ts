// §v3.0 Phase 2 — CF attribution resolution.
//
// Lives outside ehr.ts on purpose: roles.ts already imports ehr.ts, so the
// store cannot import the roster back. ehr.ts therefore accepts a resolved
// `CfAttribution` and this module is the only thing that produces one.
import type { CfAttribution } from "./ehr";
import { canProxyForCfCareManager, getStaffMember, type StaffRole } from "./roles";

export interface AttributionResult {
  ok: boolean;
  attribution?: CfAttribution;
  reason?: string;
}

/** How an entry reached the record: keyed by its own author, or proxied. */
export type CfEntryMode = "direct" | "proxy";

/**
 * Phase 1's dual access model, applied to Phase 2 writes:
 *  - a direct-login CF Care Manager authors their own rows;
 *  - an ECM Provider may key rows FOR a proxy-mode CF Care Manager, and the
 *    row records both identities.
 */
export function resolveCfAttribution(input: {
  actorStaffId: string | null | undefined;
  actorName: string;
  actorRole: StaffRole;
  onBehalfOfStaffId?: string | null;
}): AttributionResult {
  const enteredBy = {
    staffId: input.actorStaffId ?? undefined,
    staffName: input.actorName,
    role: input.actorRole,
  };
  if (!input.onBehalfOfStaffId) return { ok: true, attribution: { enteredBy } };
  const check = canProxyForCfCareManager(input.actorStaffId, input.onBehalfOfStaffId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  const subject = getStaffMember(input.onBehalfOfStaffId)!;
  return {
    ok: true,
    attribution: { enteredBy, attributedTo: { staffId: subject.id, staffName: subject.name } },
  };
}

/**
 * §Quality pass Group B — the SINGLE entry decision for a pre-release episode.
 *
 * `resolveCfAttribution` answers "may I proxy for this person?" only when the
 * caller already decided to proxy. That left a hole: for a DIRECT-mode CF Care
 * Manager the old UI simply did not ask, and an ECM Provider's entry fell
 * through to self-attribution — the direct-mode rule was never actually
 * enforced on the episode, only on the proxy call nobody made. This function
 * decides from the EPISODE's owner, so there is no path that skips the check.
 */
export function resolveEpisodeEntry(input: {
  actorStaffId: string | null | undefined;
  actorName: string;
  actorRole: StaffRole;
  episodeCfStaffId: string;
}): AttributionResult & { mode?: CfEntryMode } {
  const owner = getStaffMember(input.episodeCfStaffId);
  const enteredBy = {
    staffId: input.actorStaffId ?? undefined,
    staffName: input.actorName,
    role: input.actorRole,
  };
  // The owner keying their own list is always a direct entry.
  if (owner && input.actorStaffId === owner.id)
    return { ok: true, mode: "direct", attribution: { enteredBy } };
  const check = canProxyForCfCareManager(input.actorStaffId, input.episodeCfStaffId);
  if (!check.allowed) return { ok: false, reason: check.reason };
  return {
    ok: true,
    mode: "proxy",
    attribution: { enteredBy, attributedTo: { staffId: owner!.id, staffName: owner!.name } },
  };
}
