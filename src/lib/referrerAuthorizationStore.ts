// Privacy P3 — per-referral authorization answers and held-update reasons.
// Kept beside the referral store (not inside it) so ehr.ts stays unchanged.
// In-memory like the rest of the demo store; every change is audited.
import { AdelanteEHR } from "./ehr";
import { getActingRole, getActingStaff } from "./roles";
import type { ReferrerAuthorization, ReferrerEvent } from "./referrerPolicy";

const answers = new Map<string, ReferrerAuthorization>();
const held = new Map<string, { event: ReferrerEvent; reason: string; at: string }[]>();

function by() {
  const s = getActingStaff();
  return { name: s?.name ?? "Unknown", role: getActingRole(), staffId: s?.id };
}
function referral(id: string) {
  const r = AdelanteEHR.listReferrals().find((x) => x.id === id);
  if (!r) throw new Error("Referral not found.");
  return r;
}

export function referrerAuthorizationFor(referralId: string): ReferrerAuthorization | undefined {
  const a = answers.get(referralId);
  return a ? { ...a } : undefined;
}

export function recordReferrerAuthorization(referralId: string, answer: "yes" | "no", referrerNamed: string): ReferrerAuthorization {
  const r = referral(referralId);
  if (answer !== "yes" && answer !== "no") throw new Error("Answer yes or no.");
  if (!referrerNamed.trim()) throw new Error("Name the referrer the question asked about.");
  const actor = by();
  const a: ReferrerAuthorization = { answer, referrerNamed, recordedAt: new Date().toISOString(), recordedBy: actor };
  answers.set(referralId, a);
  AdelanteEHR._recordAudit({ category: "consent", action: "referrer_authorization_recorded", patientId: r.enrolledPatientId,
    actorId: actor.staffId, actorRole: actor.role, detail: { referralId, answer, referrerNamed } });
  AdelanteEHR._emit();
  return { ...a };
}

export function revokeReferrerAuthorization(referralId: string): void {
  const r = referral(referralId);
  const a = answers.get(referralId);
  if (!a || a.answer !== "yes" || a.revokedAt) throw new Error("There is no authorization to revoke.");
  const actor = by();
  answers.set(referralId, { ...a, revokedAt: new Date().toISOString(), revokedBy: actor });
  AdelanteEHR._recordAudit({ category: "consent", action: "referrer_authorization_revoked", patientId: r.enrolledPatientId,
    actorId: actor.staffId, actorRole: actor.role, detail: { referralId, referrerNamed: a.referrerNamed } });
  AdelanteEHR._emit();
}

export function recordHeldReferrerUpdate(referralId: string, event: ReferrerEvent, reason: string): void {
  held.set(referralId, [...(held.get(referralId) ?? []), { event, reason, at: new Date().toISOString() }]);
  AdelanteEHR._emit();
}

export function heldReferrerUpdates(referralId: string) {
  return (held.get(referralId) ?? []).map((h) => ({ ...h }));
}
