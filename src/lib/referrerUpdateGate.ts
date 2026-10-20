// Privacy P3 — store-aware gate for referrer status updates. Decides from the
// real referral, patient episodes, problems and the legal-disclosure ledger;
// records a "held" entry or, after a real send, the disclosure + audit.
import { AdelanteEHR, type Referral } from "./ehr";
import { listEpisodes } from "./outpatientCare";
import { logReferrerStatusDisclosure, part2ConsentNamesRecipient, type DisclosureActor } from "./part2Disclosure";
import { getActingRole, getActingStaff } from "./roles";
import { heldReferrerUpdates, referrerAuthorizationFor } from "./referrerAuthorizationStore";
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
  return decideReferrerUpdate(event, {
    type,
    sud,
    part2ConsentNamed: sud && part2ConsentNamesRecipient(r.enrolledPatientId, { name: r.referrerName, organization: r.referringAgency }),
    authorized: authorizationActive(referrerAuthorizationFor(r.id), referrerDisplayName(r)),
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
