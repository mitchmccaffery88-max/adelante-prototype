// Privacy P3 — store-aware gate for referrer status updates. Decides from the
// real referral, patient episodes, problems and the legal-disclosure ledger;
// records a "held" entry or, after a real send, the disclosure + audit.
import { AdelanteEHR, type Referral } from "./ehr";
import { listEpisodes } from "./outpatientCare";
import { logReferrerStatusDisclosure, part2ConsentNamesRecipient, type DisclosureActor } from "./part2Disclosure";
import { getActingRole, getActingStaff } from "./roles";
import { heldReferrerUpdates, referrerAuthorizationFor } from "./referrerAuthorizationStore";
import { consentGate } from "./consentGate";
import {
  authorizationActive, decideReferrerUpdate, referrerDisplayName, referrerTypeOf,
  type ReferrerDecision, type ReferrerEvent,
} from "./referrerPolicy";

/** Part 2 program or SUD-related referral. */
export function referralIsSud(r: Referral): boolean {
  if (r.substanceUseNeed) return true;
  const pid = r.enrolledPatientId;
  if (!pid) return false;
  if (listEpisodes(pid).some((e) => e.program === "outpatient_sud")) return true;
  return AdelanteEHR.listProblems(pid).some((p) => p.category === "sud");
}

export function referrerDecisionFor(r: Referral, event: ReferrerEvent): ReferrerDecision {
  const type = referrerTypeOf(r.referrerType);
  const sud = referralIsSud(r);
  // §B2-4: a typed record decides only when it names THIS referrer; otherwise today's stores (Option A).
  const named = [r.referrerName, r.referringAgency].filter((x): x is string => !!x && !!x.trim());
  const pid = r.enrolledPatientId;
  const part2Need = { types: ["part2_specific_written"] as const, recipients: named, item: "referral_status" };
  const authNeed = { types: ["referrer_authorization"] as const, recipients: named, purposes: event === "enrolled" ? ["enrolled_update", "status_updates"] : ["status_updates"] };
  return decideReferrerUpdate(event, {
    type,
    sud,
    // today = a live legal-disclosure row naming this referrer, only while the live (non-legacy) legal section is on.
    part2ConsentNamed: sud && (pid && named.length ? consentGate(pid, part2Need, () => part2ConsentNamesRecipient(pid, { name: r.referrerName, organization: r.referringAgency }) && AdelanteEHR.hasLegalDisclosureConsent(pid)) : part2ConsentNamesRecipient(r.enrolledPatientId, { name: r.referrerName, organization: r.referringAgency })),
    authorized: pid && named.length ? consentGate(pid, authNeed, () => authorizationActive(referrerAuthorizationFor(r.id), referrerDisplayName(r))) : authorizationActive(referrerAuthorizationFor(r.id), referrerDisplayName(r)),
  });
}

function actor(): DisclosureActor {
  const s = getActingStaff();
  return { name: s?.name ?? "Public referral form", role: s ? getActingRole() : "public", staffId: s?.id };
}

/** After a real `sent`, write one disclosure-log entry + one audit event. */
export function logSentReferrerUpdate(r: Referral, event: ReferrerEvent, d: Extract<ReferrerDecision, { send: true }>) {
  const type = referrerTypeOf(r.referrerType);
  return logReferrerStatusDisclosure({
    patientId: r.enrolledPatientId ?? `referral:${r.id}`,
    actor: actor(),
    recipient: { name: r.referrerName || "Referrer", organization: r.referringAgency || undefined, type: type === "covered_provider" ? "provider" : "other" },
    message: d.message,
    referralId: r.id,
    sud: d.recordClassSud,
    consentRef: d.message === "receipt" ? "Generic receipt — no patient information"
      : d.recordClassSud ? "Part 2 consent naming this recipient"
      : type === "covered_provider" ? "Covered provider — minimum necessary" : `Patient authorization (${event})`,
  });
}

/** The reason staff see for the newest held update, if any. */
export function latestHeldReason(r: Referral): string | undefined {
  return heldReferrerUpdates(r.id).at(-1)?.reason;
}
