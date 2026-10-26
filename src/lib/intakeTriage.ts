import { AdelanteEHR, resolveCrisisOwner } from "./ehr";
import { canAccess, getStaffMember, hasRoleAssignment, type StaffRole } from "./roles";
import { assertIntakeActor, canIntakeAct, referralForIntake, type IntakeActor } from "./intakePhaseA";
import { isRestricted } from "./chartAccess";
import { signupSafetyLink } from "./website/signupStore";
export type SafetyTier = "amber" | "red";
export type SafetySource = { kind: "referral" | "signup" | "message"; id: string; field: string; trigger: "reported_safety_flag" | "crisis_pattern"; text?: string; part2?: boolean };
type SourceRecord = { source: SafetySource; tier: SafetyTier; patientId?: string; careManagerStaffId?: string; clinicianStaffId?: string };
export type TriageReceipt = { id: string; sourceId: string; ownerName: string; ownerRole: string; at: string; gap?: string };
type TriageItem = SourceRecord & TriageReceipt & { ownerStaffId?: string; summaryStaffId?: string; crisisId?: string; status: "open" | "acknowledged" | "closed"; acknowledgedBy?: string };
const sources = new Map<string, SourceRecord>();
const triage = new Map<string, TriageItem>();
const keyOf = (source: Pick<SafetySource, "kind" | "id">) => `${source.kind}:${source.id}`;
const clinicalRoles: StaffRole[] = ["therapist", "pmhnp", "physician", "clinical_trainee", "sud_counselor", "clinical_coordinator"];
export function canReviewPreChart(actor: IntakeActor) { const s = getStaffMember(actor.staffId); return !!s && s.active !== false && hasRoleAssignment(s, actor.role) && clinicalRoles.includes(actor.role); }
/** Source ingestion is a distinct clinical/system contract, never an Intake grant to edit safety text. */
export function registerIntakeSafetySource(actor: IntakeActor, input: SourceRecord, reason: string) {
  if (!canReviewPreChart(actor)) throw new Error("Clinical safety-source capture required.");
  if (reason.trim().length < 3 || !input.source.id || !input.source.field || !["red", "amber"].includes(input.tier)) throw new Error("Structured source and reason required.");
  if (input.source.kind === "referral") {
    const r = referralForIntake(input.source.id, true);
    if (input.patientId && r.enrolledPatientId !== input.patientId) throw new Error("Source patient link mismatch.");
  }
  if (input.source.kind === "signup") {
    const link = signupSafetyLink(input.source.id);
    if (!link.exists || input.patientId !== link.patientId) throw new Error("Source signup link mismatch.");
  }
  if (input.source.kind === "message" && !AdelanteEHR.listCommunityInquiries().some(m => m.id === input.source.id && m.crisisFlagged)) throw new Error("Recorded flagged message required.");
  for (const [id, roles] of [[input.careManagerStaffId, ["ecm_provider", "cf_care_manager"]], [input.clinicianStaffId, clinicalRoles]] as [string | undefined, string[]][]) {
    const staff = getStaffMember(id);
    if (id && (!staff || staff.active === false || !roles.some(role => hasRoleAssignment(staff, role as StaffRole)))) throw new Error("Active safety destination with the required role needed.");
  }
  if (input.patientId && !AdelanteEHR.getPatient(input.patientId)) throw new Error("Patient link unavailable.");
  const k = keyOf(input.source);
  if (sources.has(k)) throw new Error("Safety source already recorded.");
  sources.set(k, { ...input, source: { ...input.source } }); AdelanteEHR._emit();
  return { sourceId: input.source.id };
}
function sourceFor(kind: SafetySource["kind"], id: string): SourceRecord {
  const registered = sources.get(`${kind}:${id}`);
  if (registered) {
    if (kind === "referral") return { ...registered, patientId: referralForIntake(id, true).enrolledPatientId };
    if (kind === "signup") return { ...registered, patientId: signupSafetyLink(id).patientId };
    return registered;
  }
  if (kind === "message") {
    const m = AdelanteEHR.listCommunityInquiries().find(x => x.id === id && x.crisisFlagged);
    if (m) return { tier: "red", source: { kind, id, field: "body", trigger: "crisis_pattern", text: m.body, part2: true } };
  }
  throw new Error("No recorded safety flag for this source.");
}
const receipt = (item: TriageItem): TriageReceipt => ({ id: item.id, sourceId: item.source.id, ownerName: item.ownerName, ownerRole: item.ownerRole, at: item.at, ...(item.gap ? { gap: item.gap } : {}) });
export function intakeSafetyRows(actor: IntakeActor) {
  if (!canIntakeAct(actor, "safety_escalation")) return [];
  const rows = [...sources.values()].map(s => ({ kind: s.source.kind, sourceId: s.source.id, label: "Needs clinical triage now", receipt: triage.has(keyOf(s.source)) ? receipt(triage.get(keyOf(s.source)) as TriageItem) : undefined }));
  for (const m of AdelanteEHR.listCommunityInquiries().filter(m => m.crisisFlagged)) if (!rows.some(r => r.kind === "message" && r.sourceId === m.id)) rows.push({ kind: "message", sourceId: m.id, label: "Needs clinical triage now", receipt: triage.has(`message:${m.id}`) ? receipt(triage.get(`message:${m.id}`) as TriageItem) : undefined });
  return rows;
}
function eligible(id?: string) { const s = getStaffMember(id); return s?.active !== false && s ? s : undefined; }
export function escalateIntakeSafety(actor: IntakeActor, kind: SafetySource["kind"], sourceId: string, reason: string): TriageReceipt {
  assertIntakeActor(actor, "safety_escalation", reason);
  const data = sourceFor(kind, sourceId); const k = keyOf(data.source); const existing = triage.get(k);
  if (existing) return receipt(existing);
  const p = data.patientId ? AdelanteEHR.getPatient(data.patientId) : undefined;
  const cm = p ? resolveCrisisOwner(p, "sdoh") : eligible(data.careManagerStaffId);
  const clinician = p ? resolveCrisisOwner(p, "clinical") : eligible(data.clinicianStaffId);
  const validClinician = clinician && clinicalRoles.some(role => hasRoleAssignment(clinician, role)) ? clinician : undefined;
  const validCm = cm && ["ecm_provider", "cf_care_manager"].some(role => hasRoleAssignment(cm, role as StaffRole)) ? cm : undefined;
  const owner = data.tier === "amber" ? validCm ?? validClinician : validClinician;
  const at = new Date().toISOString();
  const item: TriageItem = { ...data, source: { ...data.source }, id: crypto.randomUUID(), sourceId, ownerStaffId: owner?.id, ownerName: owner?.name ?? "Clinical coordinator queue", ownerRole: owner?.role ?? "clinical_coordinator", summaryStaffId: data.tier === "amber" ? validClinician?.id : undefined, at, status: "open", ...(!owner ? { gap: "No on-call clinician is defined; routed to the clinical coordinator queue." } : {}) };
  // Linked records use the existing crisis owner path; no detail is returned.
  if (p) {
    const crisis = AdelanteEHR.flagCrisis(p.id, actor.staffId ?? "Intake", "Recorded intake safety flag — source available to clinical triage", { triggerSource: "assisted_signup", severity: data.tier === "red" ? "critical" : "urgent", category: data.tier === "amber" && validCm ? "sdoh" : "clinical" });
    item.crisisId = crisis.id;
    const taskOwner = owner ? owner.caseManagerId ?? owner.id : "";
    AdelanteEHR.createCaseTask({ patientId: p.id, assignedTo: taskOwner, title: "Clinical triage needed", dueDate: at, priority: data.tier === "red" ? "stat" : "urgent", allowedRoles: owner ? [owner.role] : ["clinical_coordinator"], taskType: "intake_safety_triage", source: "intake_referral", dedupeKey: `intake-triage:${k}` });
  }
  triage.set(k, item);
  const notify = (staffId?: string) => AdelanteEHR.notify({ ...(staffId ? { recipientStaffId: staffId } : { recipientRole: "clinical_coordinator" as StaffRole }), category: "task_assigned", subject: "Clinical triage needed", body: "A recorded safety flag needs review in Escalations.", linkRoute: "/escalations", dedupeKey: `prechart-triage:${item.id}:${staffId ?? "pool"}` });
  notify(owner?.id); if (item.summaryStaffId && item.summaryStaffId !== owner?.id) notify(item.summaryStaffId);
  AdelanteEHR._emit(); return receipt(item);
}
export function preChartTodayTasks(actor: IntakeActor) {
  const staff = getStaffMember(actor.staffId);
  const careOwner = !!staff && staff.active !== false && hasRoleAssignment(staff, actor.role) && ["ecm_provider", "cf_care_manager"].includes(actor.role);
  if (!canReviewPreChart(actor) && !careOwner) return [];
  return [...triage.values()].filter(i => i.status !== "closed" && (!i.ownerStaffId ? actor.role === "clinical_coordinator" : i.ownerStaffId === actor.staffId || i.summaryStaffId === actor.staffId)).map(i => ({ id: i.id, sourceId: i.source.id, patientId: i.patientId, title: "Clinical triage needed", dueAt: i.at, ownerName: i.ownerName, status: i.status }));
}
export function preChartTriageDetail(actor: IntakeActor, id: string) {
  const i = [...triage.values()].find(x => x.id === id);
  if (!canReviewPreChart(actor) || !i || (i.ownerStaffId && i.ownerStaffId !== actor.staffId && i.summaryStaffId !== actor.staffId && actor.role !== "clinical_coordinator")) return { restricted: true, reason: "Restricted — clinical triage only." } as const;
  if (i.patientId && isRestricted(i.patientId)) return { restricted: true, reason: "Restricted record — authorized clinical review required." } as const;
  if (i.source.part2 && (!i.patientId || canAccess(actor.role, "sud_treatment", AdelanteEHR.getPatient(i.patientId)).locked)) return { id: i.id, restricted: true, reason: "42 CFR Part 2 — intake/treatment consent required." } as const;
  return { id: i.id, source: { ...i.source }, tier: i.tier, patientId: i.patientId, ownerName: i.ownerName, status: i.status };
}
export function acknowledgePreChart(actor: IntakeActor, id: string, reason: string) {
  const i = [...triage.values()].find(x => x.id === id);
  if (!canReviewPreChart(actor) || !i || (i.ownerStaffId ? i.ownerStaffId !== actor.staffId : actor.role !== "clinical_coordinator")) throw new Error("Triage owner required.");
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  i.status = "acknowledged"; i.acknowledgedBy = actor.staffId; AdelanteEHR._emit(); return { id: i.id };
}
/** Identity-confirmed link only. Never creates a chart or chooses a resemblance candidate. */
export function linkPreChartTriage(actor: IntakeActor, kind: SafetySource["kind"], sourceId: string, patientId: string, reason: string) {
  if (!canReviewPreChart(actor)) throw new Error("Clinical triage link required.");
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  const p = AdelanteEHR.getPatient(patientId); const i = triage.get(`${kind}:${sourceId}`);
  if (!p || !i || i.patientId) throw new Error("Unlinked triage item and existing patient required.");
  const verified = kind === "referral" ? referralForIntake(sourceId, true).enrolledPatientId === patientId : kind === "signup" ? signupSafetyLink(sourceId).patientId === patientId : false;
  if (!verified) throw new Error("Confirmed source-to-chart linkage required.");
  i.patientId = p.id; const source = sources.get(`${kind}:${sourceId}`); if (source) source.patientId = p.id;
  AdelanteEHR._emit(); return { id: i.id, patientId };
}