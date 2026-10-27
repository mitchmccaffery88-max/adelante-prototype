// 26 Oct (Mitch) — group request policy hooks. Registered by groupRequests.ts
// so ehr.ts never imports the policy module (no import cycle). Staff on-behalf
// requests and per-type approval rules fail closed when unregistered.
export interface GroupRequestHooks {
  /** Care-team (non-Intake) on-behalf request check. */
  staffRequest?: (input: unknown) => void;
  /** Routing after a request row is stored. */
  afterRequest?: (row: unknown) => void;
  /** Per-type approval rule (clinician-only, hard requirements). */
  beforeApprove?: (request: unknown, actor: { name: string; role: string; id?: string }) => void;
  /** 26 Oct evening (Mitch): open, non-billable groups follow their own requirements, not the care-plan gate. Absent = keep the gate. */
  skipsCarePlanEligibility?: (group: unknown) => boolean;
}
export const groupRequestHooks: GroupRequestHooks = {};
export function registerGroupRequestHooks(h: GroupRequestHooks) { Object.assign(groupRequestHooks, h); }
export function assertGroupStaffRequest(input: unknown) {
  if (!groupRequestHooks.staffRequest) throw new Error("Care-team group request boundary unavailable.");
  groupRequestHooks.staffRequest(input);
}
export function assertGroupApproval(request: { sessionId: string }, typed: boolean, actor: { name: string; role: string; id?: string }) {
  if (!groupRequestHooks.beforeApprove) { if (typed) throw new Error("Group approval rules unavailable."); return; }
  groupRequestHooks.beforeApprove(request, actor);
}
