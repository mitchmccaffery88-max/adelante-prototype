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
