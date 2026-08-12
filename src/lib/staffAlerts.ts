// §Message-routing gap #1 — out-of-band staff alert transport.
//
// Before this existed, the Crisis Queue and the staff message queue were
// "nobody is told" surfaces: an escalation or an unanswered patient message
// was only ever seen when a staff member happened to open the page. This
// module is the single dispatch point for pushing those SAME in-app
// notifications out of band (SMS today, via the real Twilio integration in
// `staffAlerts.functions.ts`).
//
// It deliberately owns NO clinical policy: recipients, wording and triggers
// are decided by the existing notification call sites in `ehr.ts`. All this
// does is record the attempt and hand it to whatever transport is installed.
// In tests (and anywhere the transport is not installed) dispatch still
// records a real, assertable row — it just never leaves the process.
import type { StaffRole } from "./roles";

export type StaffAlertKind =
  /** Any `flagCrisis` — every triggerSource, not just message-pattern. */
  | "crisis_flagged"
  /** Crisis language at the front door before a chart exists. */
  | "anonymous_crisis"
  /** A patient message went unread — the /message-queue gap. */
  | "unread_patient_message";

export type StaffAlertDelivery = "pending" | "sent" | "not_configured" | "failed";

export interface StaffAlertRequest {
  kind: StaffAlertKind;
  /** Same role the in-app notification is addressed to. */
  recipientRole: StaffRole;
  subject: string;
  /** Kept short — this becomes an SMS body. Never include free-text PHI. */
  body: string;
  linkRoute?: string;
  /** Context only, never used for access control. Absent when anonymous. */
  patientId?: string;
}

export interface StaffAlertRecord extends StaffAlertRequest {
  id: string;
  createdAt: string;
  delivery: StaffAlertDelivery;
  detail?: string;
}

export type StaffAlertTransport = (record: StaffAlertRecord) => void | Promise<void>;

const alerts: StaffAlertRecord[] = [];
let transport: StaffAlertTransport | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeStaffAlerts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Installed once by the app shell; absent in tests and during SSR. */
export function setStaffAlertTransport(t: StaffAlertTransport | undefined): void {
  transport = t;
}

export function dispatchStaffAlert(req: StaffAlertRequest): StaffAlertRecord {
  const record: StaffAlertRecord = {
    ...req,
    id: `sa_${alerts.length + 1}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    delivery: "pending",
  };
  alerts.unshift(record);
  emit();
  if (transport) {
    try {
      const r = transport(record);
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch((e: unknown) =>
          markStaffAlertDelivery(record.id, "failed", e instanceof Error ? e.message : "unknown"),
        );
      }
    } catch (e) {
      markStaffAlertDelivery(record.id, "failed", e instanceof Error ? e.message : "unknown");
    }
  }
  return record;
}

export function markStaffAlertDelivery(
  id: string,
  delivery: StaffAlertDelivery,
  detail?: string,
): void {
  const row = alerts.find((a) => a.id === id);
  if (!row) return;
  row.delivery = delivery;
  row.detail = detail;
  emit();
}

export function listStaffAlerts(): StaffAlertRecord[] {
  return [...alerts];
}

/** Test seam only. */
export function resetStaffAlerts(): void {
  alerts.length = 0;
  transport = undefined;
  emit();
}
