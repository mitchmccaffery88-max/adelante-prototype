// §Batch D — the ONE path for every registry action.
//   1. resolve the registry entry (src/lib/chartActions.ts)
//   2. check allowed() — the same function-level check the store enforces
//   3. call the store function BY REFERENCE
//   4. write exactly one standard audit event:
//        action.succeeded | action.blocked | action.cosign_routed
// Store-level audits stay; the standard event is always written, including
// for blocked attempts. Event text is Part 2-safe (see part2SafeText).
import { AdelanteEHR, type AuditEvent, type Patient } from "@/lib/ehr";
import { chartAction, REGISTRY_VERSION, type ChartAction, type ChartActor } from "@/lib/chartActions";
import { isFeatureEnabled, type FeatureId } from "@/lib/features";
import { SUD_MEDICATION_NAMES } from "@/lib/sudMedClassifier";

export const ACTION_EVENTS = ["action.succeeded", "action.blocked", "action.cosign_routed"] as const;
export type ActionEventName = (typeof ACTION_EVENTS)[number];

export interface RunActor extends ChartActor {
  staffName?: string;
  /** "View as" — the person whose workspace the actor is viewing. */
  viewingStaffId?: string;
}
export interface RunInput {
  /** Arguments passed to the store function. */
  args?: unknown[];
  /** Which store function of the action to call (defaults to the first). */
  via?: string;
}
export type RunResult<T = unknown> =
  | { ok: true; value: T; outcome: "succeeded" | "cosign_routed"; event: AuditEvent }
  | { ok: false; reason: string; event: AuditEvent; /** Present when the store ran and refused. */ value?: unknown };

// Words that must never appear in standard audit text: SUD drug names,
// SUD instruments and diagnoses. Replaced with a neutral marker.
const PART2_TERMS = [
  ...SUD_MEDICATION_NAMES,
  "asam",
  "caloms",
  "audit-c",
  "dast",
  "cows",
  "ciwa",
  "opioid",
  "alcohol",
  "substance",
  "sud",
  "oud",
  "aud",
  "f1\\d(\\.\\d+)?",
];
const PART2_RE = new RegExp(`\\b(${PART2_TERMS.join("|")})\\b`, "gi");

/** Strips Part 2 terms (SUD drugs, instruments, diagnoses) from free text. */
export function part2SafeText(text: string): string {
  return text.replace(PART2_RE, "[restricted]");
}

function reasonFromError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A store result of the `{ ok: false, error | reason }` shape is a refusal. */
function refusal(v: unknown): string | null {
  if (v && typeof v === "object" && "ok" in v && (v as { ok: unknown }).ok === false) {
    const r = v as { error?: unknown; reason?: unknown };
    return String(r.error ?? r.reason ?? "Refused by the store.");
  }
  return null;
}

function flagsFor(a: ChartAction): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of a.flags ?? []) out[f] = isFeatureEnabled(f as FeatureId);
  return out;
}

function write(
  name: ActionEventName,
  actionId: string,
  actor: RunActor,
  patient: Patient | undefined,
  outcome: string,
  reason: string | undefined,
  flags: Record<string, boolean>,
  storeName?: string,
): AuditEvent {
  return AdelanteEHR.recordActionEvent({
    action: name,
    actorRole: actor.role,
    actorId: actor.staffId,
    patientId: patient?.id,
    detail: {
      actionId,
      registryVersion: REGISTRY_VERSION,
      actorId: actor.staffId,
      actingRole: actor.role,
      ...(actor.viewingStaffId && actor.viewingStaffId !== actor.staffId ? { viewingStaffId: actor.viewingStaffId } : {}),
      ...(patient ? { patientId: patient.id } : {}),
      outcome,
      ...(reason ? { reason: part2SafeText(reason) } : {}),
      flags: Object.keys(flags).length ? flags : undefined,
      ...(storeName ? { storeFn: storeName } : {}),
      timestamp: new Date().toISOString(),
    },
  });
}

export function runAction<T = unknown>(
  actionId: string,
  actor: RunActor,
  patient: Patient | undefined,
  input: RunInput = {},
): RunResult<T> {
  let entry: ChartAction;
  try {
    entry = chartAction(actionId);
  } catch {
    const event = write("action.blocked", actionId, actor, patient, "blocked", "Unknown action.", {});
    return { ok: false, reason: "Unknown action.", event };
  }
  const flags = flagsFor(entry);
  const offFlag = Object.entries(flags).find(([, on]) => !on);
  if (offFlag) {
    const reason = `Turned off (${offFlag[0]}).`;
    return { ok: false, reason, event: write("action.blocked", actionId, actor, patient, "blocked", reason, flags) };
  }
  const answer = entry.allowed(actor, patient);
  if (answer.state === "hidden") {
    const reason = answer.reason ?? "Not available for your role.";
    return { ok: false, reason, event: write("action.blocked", actionId, actor, patient, "blocked", reason, flags) };
  }
  if (entry.needsPatient !== false && !patient && entry.group !== "billing" && entry.group !== "admin") {
    const reason = "Choose a patient first.";
    return { ok: false, reason, event: write("action.blocked", actionId, actor, patient, "blocked", reason, flags) };
  }
  const store = input.via ? entry.store.find((s) => s.name === input.via) : entry.store[0];
  if (!store) {
    const reason = `No store function "${input.via}" on this action.`;
    return { ok: false, reason, event: write("action.blocked", actionId, actor, patient, "blocked", reason, flags) };
  }
  let value: unknown;
  try {
    value = store.fn(...(input.args ?? []));
  } catch (e) {
    const reason = reasonFromError(e);
    return { ok: false, reason, event: write("action.blocked", actionId, actor, patient, "blocked", reason, flags, store.name) };
  }
  const refused = refusal(value);
  if (refused) {
    return { ok: false, reason: refused, value, event: write("action.blocked", actionId, actor, patient, "blocked", refused, flags, store.name) };
  }
  if (answer.state === "cosign") {
    const event = write("action.cosign_routed", actionId, actor, patient, "cosign_routed", answer.reason, flags, store.name);
    return { ok: true, value: value as T, outcome: "cosign_routed", event };
  }
  const event = write("action.succeeded", actionId, actor, patient, "succeeded", undefined, flags, store.name);
  return { ok: true, value: value as T, outcome: "succeeded", event };
}

/** Convenience: throws the refusal reason so existing try/catch + toast call sites keep working. */
export function runActionOrThrow<T = unknown>(actionId: string, actor: RunActor, patient: Patient | undefined, input: RunInput = {}): T {
  const r = runAction<T>(actionId, actor, patient, input);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

/** Patient lookup helper for call sites that only hold an id. */
export function patientFor(id?: string): Patient | undefined {
  return id ? AdelanteEHR.getPatient(id) : undefined;
}
