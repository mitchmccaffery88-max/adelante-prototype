// §Inbox actions (item 5 of 7) — claim / assign / done / reopen / make-a-task
// on staff inbox items: notifications addressed to the viewer (or their role)
// and unread patient message threads. Every action is enforced HERE, not in
// the UI: only a role that can already see the item may act on it or be
// assigned it, and a protected (Part 2) item never leaks detail into labels,
// audit rows or task text.
import { useSyncExternalStore } from "react";
import { AdelanteEHR, type AppNotification, type Patient } from "@/lib/ehr";
import { canAccess, STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { isMessageBodyMasked } from "@/lib/careMessageMasking";

export type InboxItemKey = string; // `n:<notificationId>` | `m:<patientId>`

export interface InboxActor {
  id: string;
  name: string;
  role: StaffRole;
}

export interface InboxItemState {
  key: InboxItemKey;
  ownerId?: string;
  ownerName?: string;
  assignedBy?: string;
  assignNote?: string;
  status: "open" | "done";
  doneBy?: string;
  doneAt?: string;
  doneNote?: string;
  taskId?: string;
}

export const PROTECTED_ITEM_LABEL = "Protected item";
export const PROTECTED_TASK_TITLE = "Follow up — protected item";
export const BILLING_ROLES: readonly StaffRole[] = ["billing", "billing_coordinator"];
export const BILLING_FEED_CATEGORIES = ["claim_blocked", "claim_status"] as const;

const state = new Map<InboxItemKey, InboxItemState>();
const listeners = new Set<() => void>();
let version = 0;
function changed() {
  version++;
  for (const l of listeners) l();
}

export function resetInboxActionsForTest() {
  state.clear();
  changed();
}

interface Resolved {
  kind: "notification" | "message";
  notification?: AppNotification;
  patient?: Patient;
  protected: boolean;
  /** Roles that can see the item at all. */
  roleOk: (role: StaffRole) => boolean;
}

function rosterRole(token?: string): StaffRole | undefined {
  if (!token) return undefined;
  return STAFF_ROSTER.find((s) => s.id === token || s.name === token)?.role;
}

function resolve(key: InboxItemKey): Resolved | undefined {
  if (key.startsWith("n:")) {
    const n = AdelanteEHR.listNotifications().find((x) => x.id === key.slice(2));
    if (!n) return undefined;
    const target = n.recipientRole ?? rosterRole(n.recipientStaffId);
    return {
      kind: "notification",
      notification: n,
      patient: n.patientId ? AdelanteEHR.getPatient(n.patientId) : undefined,
      protected: n.category === "protected_task",
      roleOk: (role) => !!target && role === target,
    };
  }
  if (key.startsWith("m:")) {
    const p = AdelanteEHR.getPatient(key.slice(2));
    if (!p) return undefined;
    const msgs = p.careMessages ?? [];
    const flagged = msgs.some((m) => m.sudFlagged);
    return {
      kind: "message",
      patient: p,
      protected: flagged,
      roleOk: (role) => {
        const a = canAccess(role, "patient_messaging", p);
        if (a.level === "none" || a.locked) return false;
        // A Part 2-restricted role can't hold a thread with a flagged message.
        return !(flagged && isMessageBodyMasked({ sudFlagged: true }, role, p));
      },
    };
  }
  return undefined;
}

export function isProtectedItem(key: InboxItemKey): boolean {
  return resolve(key)?.protected ?? true;
}

export function canHandleItem(key: InboxItemKey, role: StaffRole): boolean {
  const r = resolve(key);
  return !!r && r.roleOk(role);
}

/** Staff the item may be assigned to (roles that can already see it). */
export function assignableStaff(key: InboxItemKey) {
  const r = resolve(key);
  if (!r) return [];
  return STAFF_ROSTER.filter((s) => r.roleOk(s.role));
}

export function getItemState(key: InboxItemKey): InboxItemState {
  return state.get(key) ?? { key, status: "open" };
}

function mutate(key: InboxItemKey, fn: (s: InboxItemState) => void) {
  const s = { ...getItemState(key) };
  fn(s);
  state.set(key, s);
  changed();
  return s;
}

function guard(key: InboxItemKey, actor: InboxActor): Resolved {
  const r = resolve(key);
  if (!r) throw new Error("That inbox item no longer exists.");
  if (!r.roleOk(actor.role)) throw new Error("Your role can't act on this item.");
  return r;
}

function audit(action: string, key: InboxItemKey, r: Resolved, actor: InboxActor, extra: Record<string, unknown> = {}) {
  AdelanteEHR.recordInboxAudit({
    action,
    actorId: actor.name,
    actorRole: actor.role,
    // Protected items: no patient link, no category detail in the audit row.
    patientId: r.protected ? undefined : r.patient?.id,
    detail: {
      itemKey: key,
      itemKind: r.kind,
      protected: r.protected,
      ...(r.protected ? {} : { category: r.notification?.category }),
      ...extra,
    },
  });
}

export function claimInboxItem(key: InboxItemKey, actor: InboxActor) {
  const r = guard(key, actor);
  const s = mutate(key, (x) => {
    x.ownerId = actor.id;
    x.ownerName = actor.name;
    x.assignedBy = undefined;
    x.assignNote = undefined;
  });
  audit("inbox_item_claimed", key, r, actor);
  return s;
}

export function assignInboxItem(key: InboxItemKey, staffId: string, note: string | undefined, actor: InboxActor) {
  const r = guard(key, actor);
  const target = STAFF_ROSTER.find((s) => s.id === staffId);
  if (!target) throw new Error("Pick a staff member.");
  if (!r.roleOk(target.role))
    throw new Error(`${target.name}'s role can't see this item, so it can't be assigned to them.`);
  const clean = note?.trim() || undefined;
  const s = mutate(key, (x) => {
    x.ownerId = target.id;
    x.ownerName = target.name;
    x.assignedBy = actor.name;
    x.assignNote = clean;
  });
  audit("inbox_item_assigned", key, r, actor, {
    assigneeId: target.id,
    assigneeName: target.name,
    ...(clean && !r.protected ? { note: clean } : {}),
  });
  return s;
}

export function markInboxItemDone(key: InboxItemKey, note: string | undefined, actor: InboxActor) {
  const r = guard(key, actor);
  const clean = note?.trim() || undefined;
  const s = mutate(key, (x) => {
    x.status = "done";
    x.doneBy = actor.name;
    x.doneAt = new Date().toISOString();
    x.doneNote = clean;
  });
  audit("inbox_item_done", key, r, actor, clean && !r.protected ? { note: clean } : {});
  return s;
}

export function reopenInboxItem(key: InboxItemKey, actor: InboxActor) {
  const r = guard(key, actor);
  const s = mutate(key, (x) => {
    x.status = "open";
    x.doneBy = undefined;
    x.doneAt = undefined;
    x.doneNote = undefined;
  });
  audit("inbox_item_reopened", key, r, actor);
  return s;
}

export function makeTaskFromInboxItem(
  key: InboxItemKey,
  input: { ownerId: string; dueDate: string },
  actor: InboxActor,
) {
  const r = guard(key, actor);
  const owner = STAFF_ROSTER.find((s) => s.id === input.ownerId);
  if (!owner) throw new Error("Pick a task owner.");
  if (!r.roleOk(owner.role)) throw new Error(`${owner.name}'s role can't see this item.`);
  if (!input.dueDate) throw new Error("Pick a due date.");
  const n = r.notification;
  const title = r.protected
    ? PROTECTED_TASK_TITLE
    : r.kind === "message"
      ? `Follow up — reply to ${r.patient?.firstName ?? "patient"}'s message`
      : `Follow up — ${stripTaskPrefix(n?.subject ?? "") || "inbox item"}`;
  const detail = r.protected
    ? "Open the Inbox to view this item (access-checked)."
    : r.kind === "message"
      ? "Linked to the patient's care-team message thread."
      : n?.body;
  const task = AdelanteEHR.createCaseTask({
    patientId: r.patient?.id ?? "",
    assignedTo: owner.id,
    title,
    detail,
    dueDate: input.dueDate,
    origin: "manual",
    source: "inbox",
    dedupeKey: `inbox:${key}`,
    allowedRoles: r.protected ? [owner.role] : undefined,
  });
  if (!task) throw new Error("Could not create the task.");
  mutate(key, (x) => {
    x.taskId = task.id;
  });
  audit("inbox_item_task_created", key, r, actor, { taskId: task.id, ownerId: owner.id, dueDate: input.dueDate });
  return task;
}

/** Display label — generic for protected items, for every viewer. */
export function inboxItemLabel(key: InboxItemKey): { title: string; body?: string } {
  const r = resolve(key);
  if (!r) return { title: "Item" };
  if (r.protected) return { title: PROTECTED_ITEM_LABEL, body: "Open to view — access-checked." };
  if (r.kind === "message") return { title: `Message from ${r.patient?.firstName ?? ""} ${r.patient?.lastName ?? ""}`.trim() };
  return { title: r.notification!.subject, body: r.notification!.body };
}

export interface InboxRow {
  key: InboxItemKey;
  kind: "notification" | "message";
  createdAt: string;
  category?: string;
  patientId?: string;
  linkRoute?: string;
  linkParams?: Record<string, string>;
  state: InboxItemState;
}

/** Items the viewer can see: addressed to them / their role, or owned by them. */
export function listInboxRows(viewer: InboxActor, opts: { billingOnly?: boolean } = {}): InboxRow[] {
  const mine = AdelanteEHR.listNotificationsFor(viewer.name, viewer.role, viewer.id);
  const byId = new Map(mine.map((n) => [n.id, n]));
  for (const s of state.values()) {
    if (s.ownerId === viewer.id && s.key.startsWith("n:")) {
      const n = AdelanteEHR.listNotifications().find((x) => x.id === s.key.slice(2));
      if (n) byId.set(n.id, n);
    }
  }
  const rows: InboxRow[] = [];
  for (const n of byId.values()) {
    const key = `n:${n.id}`;
    if (!canHandleItem(key, viewer.role)) continue;
    const billing = (BILLING_FEED_CATEGORIES as readonly string[]).includes(n.category);
    if (opts.billingOnly !== undefined && billing !== opts.billingOnly) continue;
    rows.push({ key, kind: "notification", createdAt: n.createdAt, category: n.category, patientId: n.patientId, linkRoute: n.linkRoute, linkParams: n.linkParams, state: getItemState(key) });
  }
  if (!opts.billingOnly) {
    const threads = new Set(AdelanteEHR.listUnreadMessageThreads().map((t) => t.patient.id));
    for (const s of state.values()) if (s.key.startsWith("m:")) threads.add(s.key.slice(2));
    for (const pid of threads) {
      const key = `m:${pid}`;
      if (!canHandleItem(key, viewer.role)) continue;
      const p = AdelanteEHR.getPatient(pid);
      const last = (p?.careMessages ?? []).at(-1);
      rows.push({ key, kind: "message", createdAt: last?.createdAt ?? "", patientId: pid, state: getItemState(key) });
    }
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function useInboxActionsVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
}

// ---- Demo seed (through the functions above) ----
let seeded = false;
export function seedInboxActionsDemo() {
  if (seeded) return;
  seeded = true;
  const reyes: InboxActor = { id: "s-th1", name: "Dr. Marisol Reyes", role: "therapist" };
  const deneen: InboxActor = { id: "s-bc1", name: "Deneen Ford", role: "billing_coordinator" };
  const safe = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      if (import.meta.env?.DEV) console.warn("[inbox actions seed]", e);
    }
  };
  const open = listInboxRows(reyes, { billingOnly: false }).filter((r) => r.kind === "notification");
  const plain = open.filter((r) => !isProtectedItem(r.key));
  const prot = open.find((r) => isProtectedItem(r.key));
  const other = STAFF_ROSTER.find((s) => s.role === "therapist" && s.id !== reyes.id);
  if (plain[0]) safe(() => void claimInboxItem(plain[0].key, reyes));
  if (plain[1] && other) safe(() => void assignInboxItem(plain[1].key, other.id, "Can you take this one? I'm in groups all afternoon.", reyes));
  if (plain[2]) safe(() => void markInboxItemDone(plain[2].key, "Handled by phone.", reyes));
  const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  if (prot) safe(() => void makeTaskFromInboxItem(prot.key, { ownerId: reyes.id, dueDate: due }, reyes));
  // Billing feed: claim one, the other stays open.
  const bill = listInboxRows(deneen, { billingOnly: true });
  if (bill[0]) safe(() => void claimInboxItem(bill[0].key, deneen));
}

/** Drop a leading "Follow up —" / "Task assigned —" so titles never double up. */
export function stripTaskPrefix(subject: string): string {
  let s = subject.trim();
  for (;;) {
    const next = s.replace(/^(follow up|task assigned)\s*[—–:-]\s*/i, "");
    if (next === s) return s;
    s = next.trim();
  }
}
