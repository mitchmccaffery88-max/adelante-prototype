// 26 Oct (Mitch) — group join rules, per-TYPE requirements, patient catalog,
// care-team routing and decisions. Extends the existing requestJoinGroup /
// approveGroupJoinRequest / declineGroupJoinRequest path; no parallel store.
// Requirement lists are Draft — pending clinical sign-off.
import {
  AdelanteEHR,
  GROUP_BILLING,
  GROUP_CONFIDENTIALITY_CATEGORY,
  SUD_GROUP_APPROVER_ROLES,
  TELEHEALTH_CONSENT_CATEGORY,
  type GroupJoinRequest,
  type GroupSession,
} from "./ehr";
import { registerGroupRequestHooks } from "./groupRequestBoundary";
import { audienceVisible, audiencesOf, type ContentAudience } from "./contentAudience";
import { personAudiences } from "./population";
import { canAccess, getStaffMember, hasRoleAssignment, STAFF_ROSTER, type StaffMember, type StaffRole } from "./roles";
import { intakeCompleted } from "./intakePhaseA";
import { sudSignalReason } from "./sudSignal";
import { isGroupNotificationSensitive, withGroupNotificationsSuppressed } from "./groupNotifications";

export const GROUP_REQUEST_DRAFT = "Draft — pending clinical sign-off";
export type GroupJoinRule = "open" | "care_team_approval" | "invite_only";
export type GroupTypeId = "general" | "skills_open" | "dmc_ods_sud" | "reentry_cohort";
export type RequirementId =
  | "group_eligibility"
  | "sud_signal"
  | "part2_treatment_consent"
  | "confidentiality_ack"
  | "telehealth_consent"
  | "medi_cal_coverage"
  | "space"
  | "clinician_approval";
/** part2/clinical items are never named to the patient; self items may be offered; admin items are statuses. */
export type RequirementKind = "part2" | "clinical" | "self" | "admin";
export type RequirementStatus = "met" | "not_met" | "needs_review";

export const REQUIREMENTS: Record<RequirementId, { label: string; kind: RequirementKind }> = {
  group_eligibility: { label: "Group eligibility on the care plan", kind: "clinical" },
  sud_signal: { label: "SUD signal (episode, diagnosis or clinician care-plan goal)", kind: "part2" },
  part2_treatment_consent: { label: "Part 2 consent covering treatment", kind: "part2" },
  confidentiality_ack: { label: "Group confidentiality acknowledgment", kind: "self" },
  telehealth_consent: { label: "Telehealth consent (group meets online)", kind: "self" },
  medi_cal_coverage: { label: "Medi-Cal coverage status", kind: "admin" },
  space: { label: "Space in the group", kind: "admin" },
  clinician_approval: { label: "Clinician approval", kind: "clinical" },
};

/** Configurable per group TYPE, never per group. Draft — pending clinical sign-off. */
export const GROUP_TYPES: Record<GroupTypeId, { label: string; requirements: RequirementId[] }> = {
  general: { label: "General group", requirements: [] },
  skills_open: { label: "Skills group", requirements: [] },
  dmc_ods_sud: {
    label: "SUD group (DMC-ODS)",
    requirements: ["sud_signal", "part2_treatment_consent", "confidentiality_ack", "medi_cal_coverage", "clinician_approval"],
  },
  reentry_cohort: { label: "Reentry cohort", requirements: [] },
};

declare module "./ehr" {
  interface GroupJoinRequest {
    followUp?: { item: FollowUpItem; at: string; by: string; taskId?: string };
    routing?: { staffIds: string[]; taskIds: string[]; lane: "care_team" | "intake" | "clinical_coordinator" };
  }
}
export type FollowUpItem = "confidentiality_form" | "telehealth_form" | "coverage_check" | "other";
export const FOLLOW_UP_LABELS: Record<FollowUpItem, string> = {
  confidentiality_form: "Send the group confidentiality form",
  telehealth_form: "Send the telehealth consent form",
  coverage_check: "Check Medi-Cal coverage",
  other: "Other follow-up",
};

export function groupPolicy(g: GroupSession) {
  const typeId = (g.groupType && g.groupType in GROUP_TYPES ? g.groupType : "general") as GroupTypeId;
  const audiences: ContentAudience[] = Array.isArray(g.audiences)
    ? audiencesOf(g)
    : g.category === "sud_clinical_preauth" ? ["sud"] : [];
  return {
    joinRule: (g.joinRule ?? "care_team_approval") as GroupJoinRule,
    audiences,
    groupType: typeId,
    billable: g.billable ?? !!GROUP_BILLING[g.category]?.billable,
  };
}

/** The type's list plus automatic checks (existing eligibility gate, telehealth when virtual, space, county ack). */
/**
 * 26 Oct evening (Mitch): an open, non-billable group follows its own join
 * rules and type requirements only; the care-plan eligibility gate does not
 * apply unless the group's TYPE lists "group_eligibility" itself. Billable,
 * care_team_approval and invite_only groups keep every gate they had.
 * Never read by MAT/medication paths.
 */
export function skipsCarePlanEligibility(g: GroupSession): boolean {
  const pol = groupPolicy(g);
  return pol.joinRule === "open" && !pol.billable && !GROUP_TYPES[pol.groupType].requirements.includes("group_eligibility");
}

export function requirementsFor(g: GroupSession): RequirementId[] {
  const list = new Set<RequirementId>([...(skipsCarePlanEligibility(g) ? [] : ["group_eligibility" as const]), ...GROUP_TYPES[groupPolicy(g).groupType].requirements]);
  if (AdelanteEHR.groupVirtualExposure(g.id).virtual) list.add("telehealth_consent");
  if (AdelanteEHR.isGroupConfidentialityAckRequired()) list.add("confidentiality_ack");
  list.add("space");
  return [...list];
}

export function requiresClinician(g: GroupSession): boolean {
  return requirementsFor(g).some((id) => id === "clinician_approval" || REQUIREMENTS[id].kind === "part2");
}

function sudSignalMet(pid: string): boolean {
  const p = AdelanteEHR.getPatient(pid);
  const why = p ? sudSignalReason(p) : undefined;
  // Episode, diagnosis or clinician care-plan goal only — not an intake answer.
  return !!why && !/^SUD indicator/.test(why) && why !== p?.flagSources?.sud;
}

export function evaluateRequirement(g: GroupSession, pid: string, id: RequirementId): RequirementStatus {
  const p = AdelanteEHR.getPatient(pid);
  switch (id) {
    case "group_eligibility": return AdelanteEHR.isGroupEligible(pid) ? "met" : "not_met";
    case "sud_signal": return sudSignalMet(pid) ? "met" : "not_met";
    case "part2_treatment_consent": return AdelanteEHR.isConsentCategoryAuthorized(pid, "sud_treatment") ? "met" : "not_met";
    case "confidentiality_ack": return AdelanteEHR.isConsentCategoryAuthorized(pid, GROUP_CONFIDENTIALITY_CATEGORY) ? "met" : "not_met";
    case "telehealth_consent": return AdelanteEHR.isConsentCategoryAuthorized(pid, TELEHEALTH_CONSENT_CATEGORY) ? "met" : "not_met";
    case "medi_cal_coverage": {
      const c = p?.coverage;
      if (!c) return "needs_review";
      if (c.status === "active") return c.verified === "verified" ? "met" : "needs_review";
      return ["suspended", "uninsured", "none_unsure"].includes(c.status) ? "not_met" : "needs_review";
    }
    case "space": return AdelanteEHR.listGroupEnrollments(g.id).length < g.capacity ? "met" : "not_met";
    case "clinician_approval": return "needs_review";
  }
}

// ---------------------------------------------------------------------------
// Patient side
export type PatientGroupAction = "joined" | "join" | "ask" | "requested";
export interface PatientGroupRow {
  group: GroupSession;
  action: PatientGroupAction;
  /** Non-clinical items the patient can act on; clinical/Part 2 items are never listed. */
  selfNeeds: RequirementId[];
}

export function patientCanSee(g: GroupSession, pid: string): boolean {
  if (g.status === "cancelled") return false;
  const enrolled = AdelanteEHR.groupsForPatient(pid).some((x) => x.id === g.id);
  if (enrolled) return true;
  const pol = groupPolicy(g);
  if (pol.joinRule === "invite_only") return false;
  return audienceVisible({ audiences: pol.audiences }, personAudiences(pid));
}

export function patientGroupCatalog(pid: string): PatientGroupRow[] {
  const enrolled = new Set(AdelanteEHR.groupsForPatient(pid).map((g) => g.id));
  const pending = new Set(AdelanteEHR.listGroupJoinRequests({ patientId: pid, status: "pending" }).map((r) => r.sessionId));
  return AdelanteEHR.listGroupSessions()
    .filter((g) => patientCanSee(g, pid))
    .map((g) => {
      const reqs = requirementsFor(g);
      const unmet = reqs.filter((id) => evaluateRequirement(g, pid, id) !== "met");
      const selfNeeds = unmet.filter((id) => REQUIREMENTS[id].kind === "self");
      let action: PatientGroupAction;
      if (enrolled.has(g.id)) action = "joined";
      else if (pending.has(g.id)) action = "requested";
      else if (groupPolicy(g).joinRule === "open" && unmet.length === 0) action = "join";
      else action = "ask";
      return { group: g, action, selfNeeds };
    });
}

type Actor = { role: StaffRole; staffId?: string; staffName?: string };
const PATIENT_ROLE = "patient" as StaffRole;
function assertSelf(actor: Actor, pid: string) {
  if (actor.role !== PATIENT_ROLE || actor.staffId !== pid) throw new Error("Only you can do this for yourself.");
}

/** Open group with every requirement met: join directly through the one enrollment write. */
export function patientJoinGroup(actor: Actor, pid: string, sessionId: string) {
  assertSelf(actor, pid);
  const row = patientGroupCatalog(pid).find((r) => r.group.id === sessionId);
  if (!row || row.action !== "join") throw new Error("Ask your care team to join this group.");
  const e = AdelanteEHR.selfEnrollInGroup({ sessionId, patientId: pid });
  return { enrollmentId: e.id };
}

/** "Ask to join" — the existing patient requestJoinGroup path, attributed to the patient. */
export function patientAskToJoin(actor: Actor, pid: string, sessionId: string, note?: string) {
  assertSelf(actor, pid);
  const g = AdelanteEHR.getGroupSession(sessionId);
  if (!g || !patientCanSee(g, pid)) throw new Error("This group isn't available to ask for.");
  const r = AdelanteEHR.requestJoinGroup({ sessionId, patientId: pid, note });
  return { requestId: r.id, status: r.status };
}

// ---------------------------------------------------------------------------
// Staff side
const CARE_TEAM_REQUEST_ROLES: StaffRole[] = ["ecm_provider", "cf_care_manager", "therapist", "pmhnp", "physician"];
const active = (s: StaffMember | undefined): s is StaffMember => !!s && s.active !== false;
const firstHolder = (role: StaffRole) => STAFF_ROSTER.find((s) => active(s) && s.role === role) ?? STAFF_ROSTER.find((s) => active(s) && hasRoleAssignment(s, role));

export function assignedCareManager(pid: string) {
  const p = AdelanteEHR.getPatient(pid);
  return p?.caseManagerId ? STAFF_ROSTER.find((s) => active(s) && s.caseManagerId === p.caseManagerId) : undefined;
}
export function assignedClinician(pid: string) {
  const p = AdelanteEHR.getPatient(pid);
  return p?.primaryClinicianId ? STAFF_ROSTER.find((s) => active(s) && s.clinicianId === p.primaryClinicianId) : undefined;
}
function inCaseload(s: StaffMember, pid: string) {
  const p = AdelanteEHR.getPatient(pid);
  return !!p && ((!!s.caseManagerId && p.caseManagerId === s.caseManagerId) || (!!s.clinicianId && p.primaryClinicianId === s.clinicianId));
}
function seesPart2(role: StaffRole, pid: string) {
  const a = canAccess(role, "screeners_sud", AdelanteEHR.getPatient(pid));
  return a.level !== "none" && !a.locked;
}

/** Where a request goes. Pure read; used by routing and tests. A clinician who cannot approve (e.g. trainee) does not count. */
export function routeGroupRequest(g: GroupSession, pid: string): { staff: StaffMember[]; targets: { staff: StaffMember; role: StaffRole }[]; lane: "care_team" | "intake" | "clinical_coordinator" } {
  const cm = assignedCareManager(pid);
  const clAny = requiresClinician(g) ? assignedClinician(pid) : undefined;
  const cl = clAny && SUD_GROUP_APPROVER_ROLES.includes(clAny.role) ? clAny : undefined;
  const targets: { staff: StaffMember; role: StaffRole }[] = [];
  if (cm) targets.push({ staff: cm, role: cm.role });
  if (cl) targets.push({ staff: cl, role: cl.role });
  let lane: "care_team" | "intake" | "clinical_coordinator" = "care_team";
  if (!targets.length || (requiresClinician(g) && !cl)) {
    const ref = AdelanteEHR.listReferrals().find((r) => r.enrolledPatientId === pid);
    const role: StaffRole = !cm && !clAny && ref && !intakeCompleted(ref.id) ? "intake_coordinator" : "clinical_coordinator";
    const fb = firstHolder(role);
    if (fb) targets.push({ staff: fb, role });
    if (!cm && !cl) lane = role === "intake_coordinator" ? "intake" : "clinical_coordinator";
  }
  return { staff: targets.map((t) => t.staff), targets, lane };
}

const today = () => new Date().toISOString().slice(0, 10);
function routeAfterRequest(row: GroupJoinRequest) {
  const g = AdelanteEHR.getGroupSession(row.sessionId);
  if (!g) return;
  const { targets, lane } = routeGroupRequest(g, row.patientId);
  const label = row.protected || isGroupNotificationSensitive(g.category) ? "restricted group" : g.topic;
  const taskIds: string[] = [];
  for (const { staff: s, role } of targets) {
    const t = AdelanteEHR.createCaseTask({
      patientId: row.patientId,
      assignedTo: s.caseManagerId ?? s.id,
      title: `Group request: ${label} — check and decide`,
      dueDate: today(),
      taskType: "group_request",
      source: "group_request",
      allowedRoles: [role],
      dedupeKey: `group-request:${row.id}:${s.id}`,
    });
    if (t) taskIds.push(t.id);
  }
  row.routing = { staffIds: targets.map((t) => t.staff.id), taskIds, lane };
}

function assertStaffRequest(value: unknown) {
  const input = value as Parameters<typeof AdelanteEHR.requestJoinGroup>[0];
  const ob = input.onBehalf;
  const s = getStaffMember(ob?.staffId);
  if (!ob || !active(s) || !CARE_TEAM_REQUEST_ROLES.includes(ob.role) || !hasRoleAssignment(s, ob.role)) throw new Error("Care-team member required.");
  if (!inCaseload(s, input.patientId)) throw new Error("Only the patient's own care team can request a group.");
  const g = AdelanteEHR.getGroupSession(input.sessionId);
  if (g && g.category === "sud_clinical_preauth" && !seesPart2(ob.role, input.patientId)) throw new Error("42 CFR Part 2 — treatment consent required.");
}

function beforeApprove(value: unknown, actor: { name: string; role: string }) {
  const r = value as GroupJoinRequest;
  const g = AdelanteEHR.getGroupSession(r.sessionId);
  if (!g) throw new Error("Group not found.");
  if (requiresClinician(g) && !SUD_GROUP_APPROVER_ROLES.includes(actor.role as StaffRole)) throw new Error("A clinician must approve this group request.");
  // Hard requirements. Eligibility is set by approval; telehealth keeps its own audited block.
  const hard = requirementsFor(g).filter((id) => !["group_eligibility", "telehealth_consent", "clinician_approval"].includes(id));
  if (hard.some((id) => evaluateRequirement(g, r.patientId, id) === "not_met")) throw new Error("A requirement is not met yet. Use \"Needs something first\".");
}
registerGroupRequestHooks({ staffRequest: assertStaffRequest, afterRequest: (row) => routeAfterRequest(row as GroupJoinRequest), beforeApprove, skipsCarePlanEligibility: (g) => skipsCarePlanEligibility(g as GroupSession) });

/** Care team asks on the patient's behalf — same request item, staff-attributed. */
export function careTeamRequestGroup(actor: Actor, pid: string, sessionId: string, reason: string) {
  if (reason.trim().length < 3 || !actor.staffId) throw new Error("Give a reason.");
  const r = AdelanteEHR.requestJoinGroup({ sessionId, patientId: pid, onBehalf: { referralId: "", staffId: actor.staffId, role: actor.role } });
  return { requestId: r.id, status: r.status };
}

export interface RequirementView { id: RequirementId; label: string; status: RequirementStatus | "locked"; reason?: string }
/** Reviewer view: real record statuses; Part 2 items locked for roles without access. */
export function groupRequestReview(requestId: string, role: StaffRole): { requirements: RequirementView[]; clinicianRequired: boolean } | undefined {
  const r = AdelanteEHR.listGroupJoinRequests().find((x) => x.id === requestId);
  const g = r && AdelanteEHR.getGroupSession(r.sessionId);
  if (!r || !g) return undefined;
  const part2 = seesPart2(role, r.patientId);
  return {
    clinicianRequired: requiresClinician(g),
    requirements: requirementsFor(g).map((id) =>
      REQUIREMENTS[id].kind === "part2" && !part2
        ? { id, label: REQUIREMENTS[id].label, status: "locked", reason: "Part 2 — needs consent covering treatment" }
        : { id, label: REQUIREMENTS[id].label, status: evaluateRequirement(g, r.patientId, id) },
    ),
  };
}

const MSG = {
  approved: { en: "You're in the group. See Appointments, then Groups, for the times.", es: "Ya estás en el grupo. Mira Citas y luego Grupos para ver los horarios." },
  not_now: { en: "Your care team will talk with you about other options.", es: "Tu equipo de cuidado hablará contigo sobre otras opciones." },
  needs_first: { en: "Your care team needs one more thing before you join. They will reach out to you.", es: "Tu equipo de cuidado necesita una cosa más antes de que te unas. Se comunicarán contigo." },
} as const;
export const GROUP_DECISION_MESSAGES = MSG;
function messagePatient(r: GroupJoinRequest, kind: keyof typeof MSG) {
  const es = AdelanteEHR.getPatient(r.patientId)?.preferredLanguage === "es";
  AdelanteEHR.notifyMember({
    audience: "patient",
    recipientId: r.patientId,
    patientId: r.patientId,
    subject: es ? "Novedades de tu solicitud de grupo" : "Update on your group request",
    body: MSG[kind][es ? "es" : "en"],
    linkRoute: "/schedule",
    dedupeKey: `group-decision:${r.id}:${kind}`,
  });
}
function closeRouting(r: GroupJoinRequest) {
  for (const id of r.routing?.taskIds ?? []) { try { AdelanteEHR.completeCaseTask(id); } catch { /* already closed */ } }
}
function reviewer(actor: Actor) {
  const s = getStaffMember(actor.staffId);
  if (!active(s) || !hasRoleAssignment(s, actor.role)) throw new Error("Sign in as a staff member first.");
  return { name: actor.staffName || s.name, role: actor.role, id: s.id };
}
function pending(id: string) {
  const r = AdelanteEHR.listGroupJoinRequests().find((x) => x.id === id);
  if (!r || r.status !== "pending") throw new Error("No pending request.");
  return r;
}

export function approveGroupRequest(actor: Actor, requestId: string, reason: string) {
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  const r = AdelanteEHR.approveGroupJoinRequest(requestId, reviewer(actor));
  closeRouting(r); messagePatient(r, "approved"); AdelanteEHR._emit();
  return { requestId: r.id, status: r.status };
}
export function notRightNowGroupRequest(actor: Actor, requestId: string, reason: string) {
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  const r = AdelanteEHR.declineGroupJoinRequest(requestId, reason, reviewer(actor));
  closeRouting(r); messagePatient(r, "not_now"); AdelanteEHR._emit();
  return { requestId: r.id, status: r.status };
}
export function needsSomethingFirst(actor: Actor, requestId: string, item: FollowUpItem, reason: string) {
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  if (!(item in FOLLOW_UP_LABELS)) throw new Error("Choose a follow-up.");
  const who = reviewer(actor);
  const r = pending(requestId);
  const g = AdelanteEHR.getGroupSession(r.sessionId);
  if (r.protected && !seesPart2(actor.role, r.patientId)) throw new Error("Your role can't review this request.");
  if (!g) throw new Error("Group not found.");
  const s = getStaffMember(who.id)!;
  const t = AdelanteEHR.createCaseTask({
    patientId: r.patientId,
    assignedTo: s.caseManagerId ?? s.id,
    title: `Group request follow-up: ${FOLLOW_UP_LABELS[item]}`,
    dueDate: today(),
    taskType: "group_request_follow_up",
    source: "group_request",
    allowedRoles: [s.role],
    dedupeKey: `group-request-follow:${r.id}:${item}`,
  });
  r.followUp = { item, at: new Date().toISOString(), by: who.id, taskId: t?.id };
  messagePatient(r, "needs_first"); AdelanteEHR._emit();
  return { requestId: r.id, followUpTaskId: t?.id };
}

// ---------------------------------------------------------------------------
// Roster configuration (admin/clinical side)
export const GROUP_POLICY_ROLES: StaffRole[] = ["therapist", "pmhnp", "physician", "clinical_coordinator"];
export function setGroupPolicy(
  actor: Actor,
  sessionId: string,
  policy: { joinRule: GroupJoinRule; audiences: ContentAudience[]; groupType: GroupTypeId; billable: boolean },
  reason: string,
) {
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  if (!GROUP_POLICY_ROLES.includes(actor.role)) throw new Error("Clinical group owners only.");
  const g = AdelanteEHR.getGroupSession(sessionId);
  if (!g) throw new Error("Group not found.");
  if (!["open", "care_team_approval", "invite_only"].includes(policy.joinRule) || !(policy.groupType in GROUP_TYPES)) throw new Error("Choose a join rule and group type.");
  if (policy.joinRule === "open" && requiresClinicianType(policy.groupType)) throw new Error("This group type needs care-team approval.");
  g.joinRule = policy.joinRule;
  g.audiences = [...new Set(policy.audiences)].filter((a) => ["sud", "justice_involved", "advocate"].includes(a));
  g.groupType = policy.groupType;
  g.billable = !!policy.billable;
  AdelanteEHR._emit();
  return { sessionId };
}
function requiresClinicianType(t: GroupTypeId) {
  return GROUP_TYPES[t].requirements.some((id) => id === "clinician_approval" || REQUIREMENTS[id].kind === "part2");
}

// ---------------------------------------------------------------------------
// Demo seed — real store functions only, idempotent by topic.
export const DEMO_GROUP_TOPICS = {
  stress: "Stress and sleep",
  sud: "Substance use recovery group (DMC-ODS)",
  reentry: "Reentry cohort",
} as const;
export function seedGroupRequestDemo() {
  const facilitator = AdelanteEHR.listClinicians()[0]?.id;
  if (!facilitator) return;
  const have = new Set(AdelanteEHR.listGroupSessions().map((g) => g.topic));
  const at = (days: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
  const mk = (input: Parameters<typeof AdelanteEHR.createGroupSession>[0]) => { if (!have.has(input.topic)) AdelanteEHR.createGroupSession(input); };
  const CREATED = "Marisol Vega, LCSW";
  withGroupNotificationsSuppressed(() => {
    mk({ topic: DEMO_GROUP_TOPICS.stress, description: "Simple ways to calm stress and sleep better.", facilitatorId: facilitator, serviceType: "therapy_group", modality: "in_person", category: "skills_education", start: at(5, 17), durationMin: 60, capacity: 10, recurrence: { kind: "weekly", daysOfWeek: [new Date(at(5, 17)).getDay()] }, createdBy: CREATED, joinRule: "open", audiences: [], groupType: "skills_open", billable: true, language: "both" });
    mk({ topic: DEMO_GROUP_TOPICS.sud, description: "Recovery support with others working on substance use.", facilitatorId: facilitator, serviceType: "therapy_group", modality: "in_person", category: "sud_clinical_preauth", start: at(6, 11), durationMin: 90, capacity: 10, recurrence: { kind: "weekly", daysOfWeek: [new Date(at(6, 11)).getDay()] }, createdBy: CREATED, joinRule: "care_team_approval", audiences: ["sud"], groupType: "dmc_ods_sud", billable: true, language: "en" });
    mk({ topic: DEMO_GROUP_TOPICS.reentry, description: "A small group for people coming home, by invitation.", facilitatorId: facilitator, serviceType: "therapy_group", modality: "video", category: "open_psychoeducational", start: at(7, 15), durationMin: 60, capacity: 8, recurrence: { kind: "weekly", daysOfWeek: [new Date(at(7, 15)).getDay()] }, createdBy: CREATED, joinRule: "invite_only", audiences: ["justice_involved"], groupType: "reentry_cohort", billable: false, language: "both" });
  });
}
try { seedGroupRequestDemo(); } catch { /* best-effort demo seed */ }
