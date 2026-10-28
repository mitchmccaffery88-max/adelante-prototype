// 26 Oct evening (Mitch) — on-call lookup hook. Registered by onCall.ts so
// ehr.ts never imports the schedule module (no import cycle). Absent = no
// on-call clinician, which falls back to the clinical coordinator as before.
import type { StaffMember } from "./roles";

export const ON_CALL_GAP = "No on-call clinician set — sent to the clinical coordinator";
type Lookup = (at: Date) => StaffMember | undefined;
const hooks: { current?: Lookup } = {};
let siteLookup: ((staffId: string, siteId: string, at: Date) => boolean) | undefined;
export function registerOnCallSiteLookup(fn: typeof siteLookup) { siteLookup = fn; }
export function onCallForSite(staffId: string, siteId: string, at: Date) { return siteLookup?.(staffId, siteId, at) ?? false; }
export function registerOnCallLookup(fn: Lookup) { hooks.current = fn; }
export function onCallOwnerFor(at: Date = new Date()): StaffMember | undefined {
  return hooks.current?.(at);
}
