// §Turn 6 — billing / admin workspace counts. One source for the Today strip,
// the tiles and the "+ New" pickers so every count agrees. Wording is
// billing-safe: no clinical or substance-use detail ever appears here.
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt, claimBillingBucket, type Claim } from "@/lib/ehr-ext";
import { gateMessageFor } from "@/lib/dmcOdsReadiness";
import { coverageWorklistRows, type CoverageWorklistRow } from "@/lib/coverageWorklist";
import { listMatchReviews } from "@/lib/patientMatching";
import { listFlagChanges } from "@/lib/features";
import type { StaffRole } from "@/lib/roles";

export const BLOCKED_DOCS = "Blocked: clinical documentation incomplete";
const FINAL: Claim["state"][] = ["paid", "partial", "written_off", "submitted"];

/** Billing-safe reason a claim can't move forward, or null. Duplicate holds are listed separately. */
export function claimBlockLabel(c: Claim, role: StaffRole): string | null {
  if (c.duplicateReview || FINAL.includes(c.state)) return null;
  if (c.voidBlocked) return BLOCKED_DOCS;
  if (claimBillingBucket(c.state) === "draft" && gateMessageFor(role, c)) return BLOCKED_DOCS;
  if (c.rateStatus === "no_rate") return "Blocked: no rate on file";
  if (c.arrangementMissing) return "Blocked: payment arrangement not recorded";
  if (c.state === "denied") return "Denied: fix and resubmit";
  return null;
}

const ELIGIBILITY_DUE: CoverageWorklistRow["state"][] = ["never_checked", "overdue", "due", "needs_verification"];

export interface BillingWorkspace {
  blocked: { claim: Claim; reason: string }[];
  ready: Claim[];
  eligibilityDue: CoverageWorklistRow[];
  paymentsToPost: Claim[];
  holds: Claim[];
}

export function billingWorkspace(role: StaffRole, claims: Claim[] = AdelanteEHRExt.listClaims()): BillingWorkspace {
  const blocked = claims.flatMap((claim) => {
    const reason = claimBlockLabel(claim, role);
    return reason ? [{ claim, reason }] : [];
  });
  return {
    blocked,
    ready: claims.filter((c) => c.state === "generated" && !c.duplicateReview),
    eligibilityDue: coverageWorklistRows().filter((r) => ELIGIBILITY_DUE.includes(r.state)),
    paymentsToPost: claims.filter((c) => (c.patientBalanceCents ?? 0) > 0 && c.state !== "written_off"),
    holds: claims.filter((c) => Boolean(c.duplicateReview)),
  };
}

/** Billing-safe claims CSV (no diagnosis, no clinical text). */
export function exportClaimsCsv(): string {
  const head = ["claim_id", "patient_program_id", "service_date", "service_code", "units", "program", "status", "charge_cents"];
  const rows = AdelanteEHRExt.listClaims().map((c) => [
    c.id,
    AdelanteEHR.getPatient(c.patientId)?.programId ?? "",
    c.serviceDate ?? "",
    c.serviceCode ?? "",
    c.units ?? "",
    c.program ?? "",
    claimBillingBucket(c.state),
    c.chargeCents ?? "",
  ]);
  return [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export interface AdminToday {
  matching: number;
  blocked24h: number;
  failedNotifications: { patientId: string; notificationId: string; programId: string; channel: string; kind: string; at: string }[];
  flagsChanged: number;
}

export function adminToday(now: number = Date.now()): AdminToday {
  const dayAgo = now - 86400000;
  const blocked24h = AdelanteEHR.listAuditEvents({ category: "action" }).filter((e) => e.action === "action.blocked" && +new Date(e.at) >= dayAgo).length;
  const failedNotifications = AdelanteEHR.listPatients().flatMap((p) =>
    (p.notifications ?? []).filter((n) => n.state === "failed").map((n) => ({ patientId: p.id, notificationId: n.id, programId: p.programId, channel: n.channel, kind: n.kind, at: n.at })),
  );
  return {
    matching: listMatchReviews("open").length,
    blocked24h,
    failedNotifications,
    flagsChanged: listFlagChanges().filter((c) => +new Date(c.at) >= now - 7 * 86400000).length,
  };
}
