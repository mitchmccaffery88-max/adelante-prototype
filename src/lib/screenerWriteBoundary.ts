// Draft — pending clinical sign-off. Avoid store/registry module-load cycles.
import type { ScreenerDef } from "./screeners";
import type { ScreenerResult, IncompleteScreener } from "./ehr";
import type { ScreenerAnswer } from "./screenerCompleteness";
type Writer = (patientId: string, def: ScreenerDef, raw: readonly ScreenerAnswer[],
  metadata: { timepoint: ScreenerResult["timepoint"]; context: ScreenerResult["context"] }) => ScreenerResult | IncompleteScreener;
let writer: Writer | undefined;
export function registerMemberScreenerWriter(fn: Writer) { writer = fn; }
export function writeMemberScreener(...args: Parameters<Writer>) {
  if (!writer) throw new Error("Screener writer not ready.");
  return writer(...args);
}
// Draft — pending clinical sign-off. Commands wait for the registry, never bypass it.
type Followup = { patientId: string; completedAt: string };
let followupRunner: ((input: Followup) => void) | undefined;
const pendingFollowups: Followup[] = [];
export function enqueueItem9Followup(input: Followup) {
  if (followupRunner) followupRunner(input); else pendingFollowups.push(input);
}
export function registerItem9FollowupRunner(runner: (input: Followup) => void) {
  followupRunner = runner;
  for (const input of pendingFollowups.splice(0)) runner(input);
}
