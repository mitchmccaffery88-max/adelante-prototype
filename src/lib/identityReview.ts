/**
 * Identity review queue (Mitch, 26 Oct) — record-integrity decisions from the
 * public Get started flow, kept apart from account support and the website
 * inbox so the three lanes never mix.
 *
 * Who reviews: one setting, `identityReviewerRoles`, below. For now sys_admin
 * only acts; the clinical coordinator can VIEW but not act. Marked Draft —
 * permissions get a full audit before go-live.
 *
 * Every decision runs through a registry action (runAction) and writes a
 * domain audit event with ids only — never names, DOB or contact values.
 * Prototype store: in-memory, like the signup session store; goes live with
 * the Supabase schema.
 */
import { AdelanteEHR, type Patient, type Referral } from "./ehr";
import { canAccess, type StaffRole } from "./roles";
import { isRestricted } from "./chartAccess";
import { emailKey, nameKey, phoneKey } from "./signupMatch";
import { normalizeEnrollmentCode } from "./signup";
import { mergePatients } from "./patientMerge";

// ---- Referral identity fields (26 Oct) -----------------------------------
// Public referrals (family, friends, self) often arrive without a reliable
// DOB, so they carry an identity-confidence marker and can never auto-match.
declare module "./ehr" {
  interface Referral {
    /** verified_source = professional / pre-release packet; public_unverified = family, friend or self. */
    identityConfidence?: "verified_source" | "public_unverified";
    /** The referrer checked "I don't know their date of birth". */
    dobUnknown?: boolean;
    /** Optional "About how old are they?" answer from a public referrer. */
    approxAge?: string;
    /** Staff confirmed the referred person's identity (who, when, how). */
    identityConfirmedBy?: { name: string; role: string; staffId?: string; at: string; how: string };
  }
}

// ---- Configuration (single home for the reviewer setting) -----------------
/** Draft — pending executive RBAC review. Only these roles may ACT on items. */
export const identityReviewerRoles: readonly StaffRole[] = ["intake_coordinator", "sys_admin"];
/** These roles may VIEW the queue (read-only for non-reviewers). */
export const identityViewerRoles: readonly StaffRole[] = ["intake_coordinator", "sys_admin", "clinical_coordinator"];
export const IDENTITY_REVIEW_PERMISSIONS_DRAFT = "Draft — pending executive RBAC review";

export interface IdentityReviewActor {
  role: StaffRole;
  staffId?: string;
  staffName?: string;
}

export const canViewIdentityReviewRole = (role: StaffRole): boolean =>
  (identityViewerRoles as readonly string[]).includes(role);
export const canViewIdentityReview = (actor: IdentityReviewActor): boolean =>
  Boolean(actor.staffId) && canViewIdentityReviewRole(actor.role);
export const canActOnIdentityReview = (actor: IdentityReviewActor): boolean =>
  Boolean(actor.staffId) && (identityReviewerRoles as readonly string[]).includes(actor.role);

// ---- Item model ------------------------------------------------------------
export type IdentityReviewType =
  | "possible_referral_match"
  | "possible_duplicate_account"
  | "link_referral_no_code"
  | "public_referral_resemblance"
  | "code_lockout";

/** Exact copy approved 26 Oct. */
export const IDENTITY_REVIEW_TYPE_LABELS: Record<IdentityReviewType, string> = {
  possible_referral_match: "Possible referral match",
  possible_duplicate_account: "Possible duplicate account",
  link_referral_no_code: "Link referral (signed up without a code)",
  public_referral_resemblance: "Possible match to a family/public referral",
  code_lockout: "Code attempts locked",
};
export const IDENTITY_REVIEW_EMPTY = "Nothing to review. New items appear here when a sign-up might match an existing record.";

export type IdentityReviewSource = "sign-up" | "referral" | "code attempts";
export type IdentityReviewStatus = "yourturn" | "withothers" | "closed";

export interface IdentityReviewEntries {
  firstName: string;
  lastName: string;
  dob: string;
  phone?: string;
  email?: string;
  referralSource?: string;
}

export interface IdentityReviewItem {
  id: string;
  type: IdentityReviewType;
  createdAt: string;
  source: IdentityReviewSource;
  status: IdentityReviewStatus;
  assignee?: string;
  /** Signup session that raised the item, when known. */
  sessionId?: string;
  /** The new account, when one exists. */
  patientId?: string;
  /** The referral the item is about, when known. */
  referralId?: string;
  candidatePatientIds: string[];
  candidateReferralIds: string[];
  entries: IdentityReviewEntries;
  /** "Need more information" contact task; completing it returns the item to Your turn. */
  contactTaskId?: string;
  history: { at: string; action: string; by: string; reason: string }[];
}

const items: IdentityReviewItem[] = [];
let seq = 0;
const now = () => new Date().toISOString();

function itemFor(id: string): IdentityReviewItem {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error("That review item no longer exists.");
  return item;
}

/** One open item per (type, account/referral) — repeat sign-ups update, not duplicate. */
export function createIdentityReviewItem(input: {
  type: IdentityReviewType;
  source: IdentityReviewSource;
  sessionId?: string;
  patientId?: string;
  referralId?: string;
  candidatePatientIds?: string[];
  candidateReferralIds?: string[];
  entries: IdentityReviewEntries;
}): IdentityReviewItem {
  const existing = items.find(
    (i) =>
      i.status !== "closed" &&
      i.type === input.type &&
      (input.patientId ? i.patientId === input.patientId : input.referralId ? i.referralId === input.referralId : i.sessionId === input.sessionId),
  );
  if (existing) {
    existing.entries = input.entries;
    existing.candidatePatientIds = input.candidatePatientIds ?? existing.candidatePatientIds;
    existing.candidateReferralIds = input.candidateReferralIds ?? existing.candidateReferralIds;
    if (existing.status === "withothers" && !existing.contactTaskId) existing.status = "yourturn";
    return existing;
  }
  const item: IdentityReviewItem = {
    id: `ir-${++seq}`,
    type: input.type,
    createdAt: now(),
    source: input.source,
    status: "yourturn",
    assignee: "intake_coordinator",
    sessionId: input.sessionId,
    patientId: input.patientId,
    referralId: input.referralId,
    candidatePatientIds: input.candidatePatientIds ?? [],
    candidateReferralIds: input.candidateReferralIds ?? [],
    entries: input.entries,
    history: [{ at: now(), action: "created", by: "sign-up flow", reason: "" }],
  };
  items.unshift(item);
  return item;
}

/** Read-only projection: a "Need more information" item returns to Your turn once its contact task is done. */
export function listIdentityReviewItems(): IdentityReviewItem[] {
  const tasks = AdelanteEHR.listCaseTasks();
  for (const item of items) {
    if (item.status === "withothers" && item.contactTaskId) {
      const task = tasks.find((t) => t.id === item.contactTaskId);
      if (task && task.status !== "open") item.status = "yourturn";
    }
  }
  return [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export const identityReviewYourTurnCount = (): number => listIdentityReviewItems().filter((i) => i.status === "yourturn").length;
export const identityReviewWaitingDays = (item: IdentityReviewItem): number =>
  Math.max(0, Math.floor((Date.now() - +new Date(item.createdAt)) / 86_400_000));

function audit(item: IdentityReviewItem, action: string, actor: IdentityReviewActor, extraIds: Record<string, unknown> = {}): void {
  AdelanteEHR._recordAudit({
    category: "clinical",
    action,
    patientId: item.patientId,
    actorId: actor.staffId,
    actorRole: actor.role,
    detail: { itemId: item.id, ...extraIds },
  });
}

function requireReviewer(actor: IdentityReviewActor): void {
  if (!canActOnIdentityReview(actor)) throw new Error("Only an identity reviewer can decide.");
}

function requireReason(reason: string): void {
  if (reason.trim().length < 3) throw new Error("Give a reason.");
}

function candidateAllowed(actor: IdentityReviewActor, referral: Referral): boolean {
  const pid = referral.enrolledPatientId;
  const patient = pid ? AdelanteEHR.getPatient(pid) : undefined;
  if (pid && isRestricted(pid)) return false;
  if (referral.substanceUseNeed) {
    if (!patient) return false;
    // Identity-only review is not a clinical-content grant.
    if (!AdelanteEHR.isConsentCategoryAuthorized(patient.id,"sud_treatment")) return false;
  }
  return true;
}
function requireCandidate(actor: IdentityReviewActor, item: IdentityReviewItem, id: string): Referral {
  if (item.referralId !== id && !item.candidateReferralIds.includes(id)) throw new Error("Choose a candidate from this review item.");
  const referral = AdelanteEHR.listReferrals().find(r => r.id === id);
  if (!referral || !["submitted", "contacted"].includes(referral.status)) throw new Error("This referral is not open for identity review.");
  if (!candidateAllowed(actor, referral)) throw new Error("Restricted referral — authorized intake consent required.");
  if (item.patientId && isRestricted(item.patientId)) throw new Error("Restricted account — authorized review required.");
  return referral;
}

// ---- Decisions (each called through a registry action, with a reason) ------

/** Link the account to this referral: claims the referral and marks any live claim code used. */
export function identityReviewLink(
  actor: IdentityReviewActor,
  itemId: string,
  input: { referralId: string; reason: string },
): IdentityReviewItem {
  requireReviewer(actor);
  requireReason(input.reason);
  const item = itemFor(itemId);
  if (item.status === "closed") throw new Error("This item is already closed.");
  const referral = requireCandidate(actor, item, input.referralId);
  if (!item.patientId) throw new Error("There is no account to link.");
  const at = now();
  // Prototype write: the referral store exposes field-limited updaters only,
  // so the link is applied to the live record and emitted (same pattern as
  // referralChase). Goes live with the Supabase schema.
  referral.status = "enrolled";
  referral.enrolledPatientId = item.patientId;
  referral.enrolledAt = at;
  referral.enrolledBy = { staffId: actor.staffId ?? "", name: actor.staffName ?? actor.staffId ?? "", role: actor.role };
  const patient = AdelanteEHR.getPatient(item.patientId);
  if (patient && !patient.referralId) patient.referralId = referral.id;
  for (const code of AdelanteEHR.listEnrollmentCodes(item.patientId)) if (!code.consumedAt) code.consumedAt = at;
  AdelanteEHR._emit();
  item.status = "closed";
  item.history.push({ at, action: "linked", by: actor.staffName ?? actor.staffId ?? "", reason: input.reason });
  audit(item, "identity_review_linked", actor, { referralId: referral.id });
  return item;
}

/** Not the same person — closes the item; both records stay as they are. */
export function identityReviewNotSame(actor: IdentityReviewActor, itemId: string, reason: string): IdentityReviewItem {
  requireReviewer(actor);
  requireReason(reason);
  const item = itemFor(itemId);
  if (item.status === "closed") throw new Error("This item is already closed.");
  item.status = "closed";
  item.history.push({ at: now(), action: "not_same_person", by: actor.staffName ?? actor.staffId ?? "", reason });
  audit(item, "identity_review_not_same", actor);
  return item;
}

/** Need more information — With others, plus a task to contact the person. */
export function identityReviewNeedInfo(actor: IdentityReviewActor, itemId: string, reason: string): IdentityReviewItem {
  requireReviewer(actor);
  requireReason(reason);
  const item = itemFor(itemId);
  if (item.status === "closed") throw new Error("This item is already closed.");
  item.status = "withothers";
  item.history.push({ at: now(), action: "need_more_information", by: actor.staffName ?? actor.staffId ?? "", reason });
  let taskId: string | undefined;
  if (item.patientId) {
    const due = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const task = AdelanteEHR.createCaseTask({
      patientId: item.patientId,
      assignedTo: actor.staffName ?? actor.staffId ?? "",
      title: "Contact the person to confirm identity details",
      detail: "Simulated — no outreach is sent from this prototype.",
      dueDate: due,
      taskType: "identity_review_contact",
      allowedRoles: ["intake_coordinator"],
      dedupeKey: `identity-review:${item.id}:contact`,
    });
    taskId = task?.id;
    item.contactTaskId = taskId;
  }
  audit(item, "identity_review_need_info", actor, taskId ? { taskId } : {});
  return item;
}

/** Merge accounts — records the decision; the merge itself runs in the existing patient merge with its confirm step. */
export function identityReviewMerge(actor: IdentityReviewActor, itemId: string, reason: string): IdentityReviewItem {
  requireReviewer(actor);
  requireReason(reason);
  const item = itemFor(itemId);
  if (item.status === "closed") throw new Error("This item is already closed.");
  if (!item.patientId || item.candidatePatientIds.length === 0) throw new Error("There is no second record to merge with.");
  item.history.push({ at: now(), action: "merge_opened", by: actor.staffName ?? actor.staffId ?? "", reason });
  audit(item, "identity_review_merge_opened", actor, { candidatePatientIds: item.candidatePatientIds });
  return item;
}

/** Existing merge engine and consent holds, confirmed in the identity-only review view. */
export function identityReviewMergeConfirmed(actor: IdentityReviewActor, itemId: string, input: {candidatePatientId:string;reason:string;confirmed:boolean}): IdentityReviewItem {
  requireReviewer(actor);
  requireReason(input.reason);
  const item = itemFor(itemId);
  if (!input.confirmed || item.status === "closed" || !item.patientId || !item.candidatePatientIds.includes(input.candidatePatientId)) throw new Error("Confirm a candidate from this item.");
  if (identityReviewCompare(item,actor).some(c=>c.restrictedReason)) throw new Error("Restricted records — authorized review required.");
  if (!actor.staffId) throw new Error("Staff identity required.");
  const merged = mergePatients({survivorId:input.candidatePatientId,otherId:item.patientId,reason:input.reason,identityReview:true},{role:actor.role,staffId:actor.staffId,name:actor.staffName ?? actor.staffId});
  item.status="closed";
  item.history.push({at:now(),action:"merged",by:actor.staffId,reason:input.reason});
  audit(item,"identity_review_merged",actor,{mergeId:merged.id,candidatePatientId:input.candidatePatientId});
  return item;
}

// ---- Public-referral identity confirmation + claim codes -------------------
// Claim codes issued for staff-confirmed public referrals live here (the
// patient enrollment-code store is keyed by patientId, which a not-yet-joined
// referral does not have). Prototype store; goes live with the Supabase schema.
export interface ReferralClaimCode {
  code: string;
  referralId: string;
  issuedBy?: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
}

const referralClaimCodes: ReferralClaimCode[] = [];
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 90 * 86_400_000;

function mintCode(): string {
  const block = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
      .join("");
  return `RE-${block()}-${block()}`;
}

export function issueReferralClaimCode(referralId: string, actor: IdentityReviewActor): ReferralClaimCode {
  const live = referralClaimCodes.find((c) => c.referralId === referralId && !c.consumedAt && +new Date(c.expiresAt) > Date.now());
  if (live) return live;
  const at = now();
  const code: ReferralClaimCode = {
    code: mintCode(),
    referralId,
    issuedBy: actor.staffId,
    issuedAt: at,
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  };
  referralClaimCodes.push(code);
  return code;
}

export function referralClaimCodeFor(raw: string): ReferralClaimCode | undefined {
  const code = normalizeEnrollmentCode(raw);
  return referralClaimCodes.find((c) => c.code === code);
}

export function consumeReferralClaimCode(code: ReferralClaimCode): void {
  code.consumedAt = now();
}

/** Mark identity confirmed by staff on a public referral and issue its claim code. */
export function identityReviewConfirm(
  actor: IdentityReviewActor,
  itemId: string,
  input: { how: string; reason: string },
): { item: IdentityReviewItem; code: ReferralClaimCode } {
  requireReviewer(actor);
  requireReason(input.reason);
  if (!input.how.trim()) throw new Error("Record how identity was confirmed.");
  const item = itemFor(itemId);
  if (item.status === "closed") throw new Error("This item is already closed.");
  const referralId = item.referralId;
  if (!referralId) throw new Error("Choose the referral to confirm.");
  const referral = requireCandidate(actor, item, referralId);
  const at = now();
  referral.identityConfirmedBy = { name: actor.staffName ?? actor.staffId ?? "", role: actor.role, staffId: actor.staffId, at, how: input.how };
  referral.identityConfidence = "verified_source";
  const code = issueReferralClaimCode(referral.id, actor);
  AdelanteEHR._emit();
  item.status = "closed";
  item.history.push({ at, action: "identity_confirmed", by: actor.staffName ?? actor.staffId ?? "", reason: input.reason });
  audit(item, "identity_review_confirmed", actor, { referralId: referral.id, claimCodeIssued: true });
  return { item, code };
}

// ---- Detail-view projections (identity fields only — never clinical) -------
export interface IdentityCandidateView {
  kind: "account" | "referral";
  id: string;
  firstName: string;
  lastName: string;
  dob?: string;
  approxAge?: string;
  phone?: string;
  email?: string;
  referralSource?: string;
  referrerType?: string;
  identityConfidence?: string;
  createdAt: string;
  hasAccount?: boolean;
  restrictedReason?: string;
}

const patientView = (p: Patient): IdentityCandidateView => ({
  kind: "account",
  id: p.id,
  firstName: p.firstName,
  lastName: p.lastName,
  dob: p.dob,
  phone: p.phone,
  email: p.email,
  createdAt: p.enrolledAt,
  hasAccount: Boolean(p.signupCredential),
});

const referralView = (r: Referral): IdentityCandidateView => ({
  kind: "referral",
  id: r.id,
  firstName: r.firstName,
  lastName: r.lastName,
  dob: r.dob,
  approxAge: r.approxAge,
  phone: r.phone,
  email: r.email,
  referralSource: r.referralSource,
  referrerType: r.referrerType,
  identityConfidence: r.identityConfidence,
  createdAt: r.createdAt,
});

/** Side-by-side compare: the new account plus every candidate record/referral, identity fields only. */
export function identityReviewCompare(item: IdentityReviewItem, actor?: IdentityReviewActor): IdentityCandidateView[] {
  if (!actor || !canViewIdentityReview(actor)) return [];
  const out: IdentityCandidateView[] = [];
  if (item.patientId) {
    const p = AdelanteEHR.getPatient(item.patientId);
    if (p) out.push(patientView(p));
  }
  for (const id of item.candidatePatientIds) {
    if (id === item.patientId) continue;
    const p = AdelanteEHR.getPatient(id);
    if (p) out.push(patientView(p));
  }
  const referralIds = new Set([...(item.referralId ? [item.referralId] : []), ...item.candidateReferralIds]);
  for (const id of referralIds) {
    const r = AdelanteEHR.listReferrals().find((x) => x.id === id);
    if (r) out.push(referralView(r));
  }
  return out.map(candidate => {
    const referral = candidate.kind === "referral" ? AdelanteEHR.listReferrals().find(r => r.id === candidate.id) : undefined;
    const pid = candidate.kind === "account" ? candidate.id : referral?.enrolledPatientId;
    const patient = pid ? AdelanteEHR.getPatient(pid) : undefined;
    const restricted = pid && isRestricted(pid);
    const p2 = referral && !candidateAllowed(actor,referral);
    return restricted || p2 ? {kind:candidate.kind,id:candidate.id,firstName:"",lastName:"",createdAt:candidate.createdAt,restrictedReason:restricted ? "Restricted record — authorized review required" : "42 CFR Part 2 — intake consent required"} : candidate;
  });
}

/** Candidate referrals a reviewer may link this account to (open, not already enrolled). */
export function linkableReferrals(item: IdentityReviewItem, actor: IdentityReviewActor): Referral[] {
  if (!canActOnIdentityReview(actor)) return [];
  const ids = new Set([...(item.referralId ? [item.referralId] : []), ...item.candidateReferralIds]);
  return AdelanteEHR.listReferrals().filter(r => ["submitted", "contacted"].includes(r.status) && ids.has(r.id) && candidateAllowed(actor,r));
}

/** Identity-field match hints for the compare view (display only). */
export function identityMatchHints(a: IdentityCandidateView, b: IdentityCandidateView): string[] {
  const hints: string[] = [];
  if (nameKey(a.firstName) === nameKey(b.firstName)) hints.push("first name");
  if (nameKey(a.lastName) === nameKey(b.lastName)) hints.push("last name");
  if (a.dob && b.dob && a.dob === b.dob) hints.push("date of birth");
  if (phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone)) hints.push("phone");
  if (emailKey(a.email) && emailKey(a.email) === emailKey(b.email)) hints.push("email");
  return hints;
}
