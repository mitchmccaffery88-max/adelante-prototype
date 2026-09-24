// §Phase 6c — patient-facing group-access text notifications.
//
// Mirrors `staffAlerts.ts` (in-process ledger + pluggable transport), but for
// PATIENTS. Owns no clinical policy: the store (`ehr.ts`) decides who is
// affected, checks SMS consent + phone, and composes the copy through
// `composeGroupNotification` below. This module records every attempt —
// including skips — and hands real sends to whatever transport is installed.
//
// PART 2 RULE: a group whose category is 42 CFR Part 2 content (or unknown)
// is never named, dated or timed in a text. See `isGroupNotificationSensitive`.
// Join links, addresses and rosters are never included for ANY group.

export type GroupNotificationEvent =
  | "enrollment_added"
  | "enrollment_ended"
  | "session_cancelled"
  | "occurrence_cancelled"
  | "occurrence_rescheduled";

export type GroupNotificationDelivery =
  | "pending"
  | "sent"
  | "not_configured"
  | "failed"
  | "skipped";

export type GroupNotificationSkipReason = "no_sms_consent" | "no_phone";

export interface GroupNotificationTrigger {
  actorId: string;
  kind: "staff" | "patient" | "system";
}

export interface GroupNotificationRecord {
  id: string;
  patientId: string;
  sessionId: string;
  event: GroupNotificationEvent;
  /** True when the generic, non-naming copy was used. */
  sensitive: boolean;
  body: string;
  /** Only present when an attempt is made; never stored for skips. */
  to?: string;
  triggeredBy: GroupNotificationTrigger;
  createdAt: string;
  delivery: GroupNotificationDelivery;
  skipReason?: GroupNotificationSkipReason;
  detail?: string;
}

export type GroupNotificationTransport = (
  record: GroupNotificationRecord,
) => void | Promise<void>;

/**
 * Only the two categories `noteGateClass` already treats as non-Part 2 get
 * specific copy. `sud_clinical_preauth` and anything unknown/missing fail
 * closed to the generic message.
 */
export function isGroupNotificationSensitive(category: string | undefined): boolean {
  return !(category === "skills_education" || category === "open_psychoeducational");
}

export const GENERIC_GROUP_NOTIFICATION =
  "Adelante: You have a group session update — check your patient portal for details. Reply STOP to stop these texts.";

function fmtWhen(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(+d)) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function composeGroupNotification(input: {
  event: GroupNotificationEvent;
  category: string | undefined;
  topic: string;
  when?: string;
  newWhen?: string;
}): { body: string; sensitive: boolean } {
  const sensitive = isGroupNotificationSensitive(input.category);
  if (sensitive) return { body: GENERIC_GROUP_NOTIFICATION, sensitive };
  const t = input.topic.trim().slice(0, 80);
  const when = fmtWhen(input.when);
  const newWhen = fmtWhen(input.newWhen);
  const tail = " Details are in your patient portal. Reply STOP to stop these texts.";
  let lead: string;
  switch (input.event) {
    case "enrollment_added":
      lead = `You're signed up for the group "${t}".`;
      break;
    case "enrollment_ended":
      lead = `You're no longer enrolled in the group "${t}".`;
      break;
    case "session_cancelled":
      lead = `The group "${t}" has been cancelled.`;
      break;
    case "occurrence_cancelled":
      lead = `The "${t}" group meeting${when ? ` on ${when}` : ""} is cancelled.`;
      break;
    case "occurrence_rescheduled":
      lead = `The "${t}" group meeting${when ? ` on ${when}` : ""} has moved${newWhen ? ` to ${newWhen}` : ""}.`;
      break;
  }
  return { body: `Adelante: ${lead}${tail}`.slice(0, 320), sensitive };
}

const records: GroupNotificationRecord[] = [];
let transport: GroupNotificationTransport | undefined;
let suppressed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeGroupNotifications(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setGroupNotificationTransport(t: GroupNotificationTransport | undefined): void {
  transport = t;
}

/** Used by the demo seed so booting never records or sends anything. */
export function withGroupNotificationsSuppressed<T>(fn: () => T): T {
  const prev = suppressed;
  suppressed = true;
  try {
    return fn();
  } finally {
    suppressed = prev;
  }
}

export function areGroupNotificationsSuppressed(): boolean {
  return suppressed;
}

export function dispatchGroupNotification(
  req: Omit<GroupNotificationRecord, "id" | "createdAt" | "delivery">,
): GroupNotificationRecord | undefined {
  if (suppressed) return undefined;
  const record: GroupNotificationRecord = {
    ...req,
    id: `gn_${records.length + 1}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    delivery: req.skipReason ? "skipped" : "pending",
  };
  records.unshift(record);
  emit();
  // No phone / no consent → the transport is NEVER called.
  if (record.delivery === "pending" && transport) {
    try {
      const r = transport(record);
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch((e: unknown) =>
          markGroupNotificationDelivery(
            record.id,
            "failed",
            e instanceof Error ? e.message : "unknown",
          ),
        );
      }
    } catch (e) {
      markGroupNotificationDelivery(record.id, "failed", e instanceof Error ? e.message : "unknown");
    }
  }
  return record;
}

export function markGroupNotificationDelivery(
  id: string,
  delivery: "sent" | "not_configured" | "failed",
  detail?: string,
): void {
  const r = records.find((x) => x.id === id);
  if (!r) return;
  r.delivery = delivery;
  r.detail = detail;
  emit();
}

export function listGroupNotifications(filter?: {
  sessionId?: string;
  patientId?: string;
}): GroupNotificationRecord[] {
  return records.filter(
    (r) =>
      (!filter?.sessionId || r.sessionId === filter.sessionId) &&
      (!filter?.patientId || r.patientId === filter.patientId),
  );
}

/** Tests only. */
export function __resetGroupNotifications(): void {
  records.length = 0;
  transport = undefined;
  suppressed = false;
}
