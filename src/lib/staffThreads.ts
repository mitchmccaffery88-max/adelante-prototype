// §U2 — Staff-to-staff messaging (care team threads + direct threads).
//
// Staff only: nothing here is ever read by a patient or advocate shell, and
// notifications are always `audience: "staff"` with a fixed neutral subject
// and NO message preview. Audits carry ids and counts, never message text.
//
// Rules (Draft — pending clinical sign-off):
//   • Patient-linked participants must be able to access that patient:
//     assigned (case manager / primary clinician / prescriber), named owner of
//     an open escalation for that patient, or an org-wide role
//     (THREAD_ORG_WIDE_ROLES).
//   • A thread is "Contains SUD information" when started from SUD content by
//     someone who can see it, or when a participant flags it. People without
//     SUD access (roleSeesAsamSection) can't be added to such a thread.
//   • Chart references show neutral link text; the item label shows only to a
//     viewer who can open it.
import { AdelanteEHR, type Patient } from "./ehr";
import { roleSeesAsamSection } from "./asamReporting";
import { isAssignedTo } from "./caseloadScope";
import { STAFF_ROSTER, type StaffMember, type StaffRole } from "./roles";
import { getEscalation, listEscalations } from "./escalations";

export const THREAD_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const THREAD_NOTIFY_SUBJECT = "New message in a care team thread";
export const DIRECT_NOTIFY_SUBJECT = "New message in a team thread";
export const THREAD_NOTIFY_BODY = "Open Messages → Team to read it.";
export const SUD_THREAD_LABEL = "Contains SUD information";
export const SUD_BLOCK_REASON = "This thread contains SUD information, and this person's role can't see SUD records.";
export const SCOPE_BLOCK_REASON = "This person isn't on this patient's care team, so they can't join this thread.";
/** Org-wide roles that may join any patient's care team thread. Draft. */
export const THREAD_ORG_WIDE_ROLES: readonly StaffRole[] = ["clinical_coordinator", "sys_admin", "physician", "nurse_rn"];
const NO_MESSAGING: readonly StaffRole[] = ["billing", "billing_coordinator", "credentialing_coordinator"];

export interface ChartRef {
  /** Chart section id used for the link (?section=). */
  sectionId: string;
  /** Item label (e.g. "Progress note Oct 2") — shown only if the viewer can open it. */
  label: string;
  sud?: boolean;
}
export interface ThreadMessage {
  id: string;
  authorStaffId: string;
  authorName: string;
  at: string;
  body: string;
  mentions: string[];
  refs: ChartRef[];
}
export interface ThreadParticipant {
  staffId: string;
  name: string;
  role: StaffRole;
  addedAt: string;
  lastReadAt?: string;
}
export interface StaffThread {
  id: string;
  kind: "care_team" | "direct";
  patientId?: string;
  subject: string;
  containsSud: boolean;
  status: "open" | "resolved";
  escalationKey?: string;
  createdBy: string;
  createdAt: string;
  resolvedAt?: string;
  participants: ThreadParticipant[];
  messages: ThreadMessage[];
}
export interface MentionItem {
  id: string;
  threadId: string;
  messageId: string;
  staffId: string;
  patientId?: string;
  createdAt: string;
  clearedAt?: string;
  clearedBy?: "reply" | "done";
}
export interface ThreadActor {
  staffId: string;
  name: string;
  role: StaffRole;
}

const threads: StaffThread[] = [];
const mentions: MentionItem[] = [];
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(++seq).toString(36)}`;
export function _resetStaffThreads(): void {
  threads.length = 0;
  mentions.length = 0;
}

const staff = (sid: string): StaffMember | undefined => STAFF_ROSTER.find((m) => m.id === sid && m.active !== false);
export const canMessageStaff = (role: StaffRole) => !NO_MESSAGING.includes(role);

/** Can this staff member access this patient (caseload or role scope)? */
export function staffCanAccessPatient(m: StaffMember, p: Patient): boolean {
  if (NO_MESSAGING.includes(m.role)) return false;
  if (THREAD_ORG_WIDE_ROLES.includes(m.role)) return true;
  if (isAssignedTo(p, { caseManagerId: m.caseManagerId, clinicianId: m.clinicianId, staffId: m.id })) return true;
  if (p.primaryClinicianId === m.id) return true;
  return listEscalations({ role: "clinical_coordinator" }).some((r) => r.patientId === p.id && r.ownerStaffId === m.id && r.status !== "resolved");
}
const seesSud = (m: { role: StaffRole }, p?: Patient) => !!p && roleSeesAsamSection(m.role, p);

/** Why `candidate` can't join `thread` (null = allowed). */
export function participantBlockReason(thread: Pick<StaffThread, "kind" | "patientId" | "containsSud">, candidateId: string): string | null {
  const m = staff(candidateId);
  if (!m) return "Choose an active staff member.";
  if (!canMessageStaff(m.role)) return "This person's role doesn't use team messaging.";
  if (thread.kind === "direct") return null;
  const p = thread.patientId ? AdelanteEHR.getPatient(thread.patientId) : undefined;
  if (!p) return "Patient not found.";
  if (!staffCanAccessPatient(m, p)) return SCOPE_BLOCK_REASON;
  if (thread.containsSud && !seesSud(m, p)) return SUD_BLOCK_REASON;
  return null;
}

function mustBeParticipant(t: StaffThread, a: ThreadActor) {
  if (!t.participants.some((p) => p.staffId === a.staffId)) throw new Error("You're not in this thread.");
}
const getOrThrow = (threadId: string) => {
  const t = threads.find((x) => x.id === threadId);
  if (!t) throw new Error("Thread not found.");
  return t;
};
const audit = (action: string, t: StaffThread, a: ThreadActor, extra: Record<string, unknown> = {}) =>
  AdelanteEHR._recordAudit({
    category: "messaging",
    action,
    patientId: t.patientId,
    actorId: a.name,
    actorRole: a.role,
    detail: { threadId: t.id, threadKind: t.kind, ...(t.escalationKey ? { escalationKey: t.escalationKey } : {}), ...extra },
  });
const asParticipant = (m: StaffMember): ThreadParticipant => ({ staffId: m.id, name: m.name, role: m.role, addedAt: new Date().toISOString() });

export function startStaffThread(
  input: { kind: "care_team" | "direct"; patientId?: string; subject?: string; participantIds: string[]; escalationKey?: string; fromSudContent?: boolean },
  actor: ThreadActor,
): StaffThread {
  if (!canMessageStaff(actor.role)) throw new Error("Your role doesn't use team messaging.");
  const me = staff(actor.staffId);
  if (!me) throw new Error("Choose an active staff member.");
  let p: Patient | undefined;
  let containsSud = false;
  if (input.kind === "care_team") {
    p = input.patientId ? AdelanteEHR.getPatient(input.patientId) : undefined;
    if (!p) throw new Error("Choose a patient for a care team thread.");
    if (!staffCanAccessPatient(me, p)) throw new Error("You can only message about patients you can access.");
    let fromSud = !!input.fromSudContent;
    if (input.escalationKey) {
      const row = getEscalation(input.escalationKey, { role: actor.role, staffId: actor.staffId });
      if (!row || row.patientId !== p.id) throw new Error("Escalation not found.");
      fromSud = fromSud || (row.sud && !row.masked);
    }
    // Only someone who actually saw SUD content can start an SUD thread.
    containsSud = fromSud && seesSud(me, p);
  } else if (input.patientId) throw new Error("Direct threads have no patient.");
  const t: StaffThread = {
    id: id("thr"),
    kind: input.kind,
    patientId: p?.id,
    subject: (input.subject?.trim() || (input.kind === "care_team" ? "Care team" : "Direct message")).slice(0, 120),
    containsSud,
    status: "open",
    escalationKey: input.escalationKey,
    createdBy: actor.name,
    createdAt: new Date().toISOString(),
    participants: [asParticipant(me)],
    messages: [],
  };
  for (const pid of new Set(input.participantIds.filter((x) => x !== me.id))) {
    const why = participantBlockReason(t, pid);
    if (why) throw new Error(why);
    t.participants.push(asParticipant(staff(pid)!));
  }
  if (t.kind === "direct" && t.participants.length < 2) throw new Error("Add at least one person.");
  threads.push(t);
  audit("staff_thread_started", t, actor, { participantCount: t.participants.length, containsSud: t.containsSud });
  AdelanteEHR._emit();
  return t;
}

export function addThreadParticipant(threadId: string, staffId: string, actor: ThreadActor): StaffThread {
  const t = getOrThrow(threadId);
  mustBeParticipant(t, actor);
  if (t.participants.some((p) => p.staffId === staffId)) throw new Error("Already in this thread.");
  const why = participantBlockReason(t, staffId);
  if (why) throw new Error(why);
  t.participants.push(asParticipant(staff(staffId)!));
  audit("staff_thread_participant_added", t, actor, { addedStaffId: staffId });
  AdelanteEHR._emit();
  return t;
}

/** A participant marks the thread as containing SUD information. Members who can't see SUD are refused. */
export function flagThreadSud(threadId: string, actor: ThreadActor): StaffThread {
  const t = getOrThrow(threadId);
  mustBeParticipant(t, actor);
  if (t.kind !== "care_team") throw new Error("Only care team threads can be flagged.");
  if (t.containsSud) return t;
  const p = AdelanteEHR.getPatient(t.patientId!);
  if (!seesSud(actor, p)) throw new Error("Your role can't flag SUD information.");
  const blocked = t.participants.filter((x) => !seesSud(x, p));
  if (blocked.length) throw new Error(`Remove ${blocked.map((b) => b.name).join(", ")} first — their role can't see SUD records.`);
  t.containsSud = true;
  audit("staff_thread_flagged_sud", t, actor);
  AdelanteEHR._emit();
  return t;
}

/** Mentions are @First Last or @First; only thread participants can be mentioned. */
export function parseMentions(body: string, t: StaffThread): string[] {
  const out = new Set<string>();
  for (const p of t.participants) {
    const [first] = p.name.split(" ");
    const re = new RegExp(`@(${escapeRe(p.name)}|${escapeRe(first)})\\b`, "i");
    if (re.test(body)) out.add(p.staffId);
  }
  return [...out];
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function postThreadMessage(threadId: string, input: { body: string; refs?: ChartRef[] }, actor: ThreadActor): ThreadMessage {
  const t = getOrThrow(threadId);
  mustBeParticipant(t, actor);
  if (t.status === "resolved") throw new Error("Reopen the thread to reply.");
  const body = input.body?.trim();
  if (!body) throw new Error("Write a message first.");
  const refs = input.refs ?? [];
  if (refs.some((r) => r.sud) && !t.containsSud) throw new Error("Flag the thread as containing SUD information before linking SUD items.");
  const msg: ThreadMessage = { id: id("msg"), authorStaffId: actor.staffId, authorName: actor.name, at: new Date().toISOString(), body, mentions: parseMentions(body, t).filter((x) => x !== actor.staffId), refs };
  t.messages.push(msg);
  const me = t.participants.find((p) => p.staffId === actor.staffId)!;
  me.lastReadAt = msg.at;
  // Replying clears the author's own open mention items in this thread.
  for (const m of mentions) if (m.threadId === t.id && m.staffId === actor.staffId && !m.clearedAt) { m.clearedAt = msg.at; m.clearedBy = "reply"; }
  for (const sid of msg.mentions) {
    mentions.push({ id: id("men"), threadId: t.id, messageId: msg.id, staffId: sid, patientId: t.patientId, createdAt: msg.at });
  }
  for (const p of t.participants) {
    if (p.staffId === actor.staffId) continue;
    AdelanteEHR.notify({
      recipientStaffId: p.staffId,
      category: "task_assigned",
      subject: t.kind === "care_team" ? THREAD_NOTIFY_SUBJECT : DIRECT_NOTIFY_SUBJECT,
      body: THREAD_NOTIFY_BODY,
      linkRoute: "/message-queue",
      dedupeKey: `staff-thread:${t.id}:${msg.id}:${p.staffId}`,
    });
  }
  audit("staff_thread_message_posted", t, actor, { messageId: msg.id, mentionCount: msg.mentions.length, refCount: refs.length });
  AdelanteEHR._emit();
  return msg;
}

export function markThreadRead(threadId: string, actor: ThreadActor): void {
  const t = getOrThrow(threadId);
  mustBeParticipant(t, actor);
  const me = t.participants.find((p) => p.staffId === actor.staffId)!;
  const last = t.messages.at(-1)?.at;
  if (!last || (me.lastReadAt && me.lastReadAt >= last)) return;
  me.lastReadAt = last;
  audit("staff_thread_read", t, actor);
  AdelanteEHR._emit();
}

export function resolveStaffThread(threadId: string, actor: ThreadActor): StaffThread {
  const t = getOrThrow(threadId);
  mustBeParticipant(t, actor);
  if (t.status === "resolved") throw new Error("Already resolved.");
  t.status = "resolved";
  t.resolvedAt = new Date().toISOString();
  audit("staff_thread_resolved", t, actor);
  AdelanteEHR._emit();
  return t;
}
export function reopenStaffThread(threadId: string, actor: ThreadActor): StaffThread {
  const t = getOrThrow(threadId);
  mustBeParticipant(t, actor);
  if (t.status === "open") throw new Error("Already open.");
  t.status = "open";
  t.resolvedAt = undefined;
  audit("staff_thread_reopened", t, actor);
  AdelanteEHR._emit();
  return t;
}

export function markMentionDone(mentionId: string, actor: ThreadActor): MentionItem {
  const m = mentions.find((x) => x.id === mentionId);
  if (!m || m.staffId !== actor.staffId) throw new Error("Only the person mentioned can mark this done.");
  if (m.clearedAt) return m;
  m.clearedAt = new Date().toISOString();
  m.clearedBy = "done";
  const t = getOrThrow(m.threadId);
  audit("staff_thread_mention_done", t, actor, { mentionId });
  AdelanteEHR._emit();
  return m;
}

// ---------------------------------------------------------------------------
// Reads (staff only)
// ---------------------------------------------------------------------------
export function listThreadsFor(viewer: { staffId?: string; role: StaffRole }): StaffThread[] {
  if (!viewer.staffId || !canMessageStaff(viewer.role)) return [];
  return threads.filter((t) => t.participants.some((p) => p.staffId === viewer.staffId)).sort((a, b) => (b.messages.at(-1)?.at ?? b.createdAt).localeCompare(a.messages.at(-1)?.at ?? a.createdAt));
}
export function getThreadFor(threadId: string, viewer: { staffId?: string; role: StaffRole }): StaffThread | undefined {
  return listThreadsFor(viewer).find((t) => t.id === threadId);
}
export function threadsForEscalation(key: string, viewer: { staffId?: string; role: StaffRole }): StaffThread[] {
  return listThreadsFor(viewer).filter((t) => t.escalationKey === key);
}
export function openMentionsFor(staffId?: string): MentionItem[] {
  if (!staffId) return [];
  return mentions.filter((m) => m.staffId === staffId && !m.clearedAt);
}
export function unreadCount(t: StaffThread, staffId: string): number {
  const me = t.participants.find((p) => p.staffId === staffId);
  return t.messages.filter((m) => m.authorStaffId !== staffId && (!me?.lastReadAt || m.at > me.lastReadAt)).length;
}
/** Read receipts for a message: who has read up to it. */
export function readBy(t: StaffThread, msg: ThreadMessage): string[] {
  return t.participants.filter((p) => p.staffId !== msg.authorStaffId && p.lastReadAt && p.lastReadAt >= msg.at).map((p) => p.name);
}
/** Neutral link text + label only if the viewer can open it. */
export function chartRefView(ref: ChartRef, viewer: { role: StaffRole }, patient?: Patient): { text: string; canOpen: boolean } {
  const canOpen = !!patient && (!ref.sud || roleSeesAsamSection(viewer.role, patient));
  return { text: canOpen ? `Chart item: ${ref.label}` : "Chart item — restricted for your role", canOpen };
}
/** Staff a viewer may add to a thread (with a reason when blocked). */
export function participantOptions(t: Pick<StaffThread, "kind" | "patientId" | "containsSud">, excludeIds: string[]): { member: StaffMember; reason: string | null }[] {
  return STAFF_ROSTER.filter((m) => m.active !== false && !excludeIds.includes(m.id) && canMessageStaff(m.role)).map((member) => ({ member, reason: participantBlockReason(t, member.id) }));
}
